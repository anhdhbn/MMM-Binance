Module.register("MMM-Binance", {

	defaults: {
		apiKey: "",
		apiSecret: "",
		developerMode: false,
		maxItems: 5,
		fontSize: "small",
		quoteCurrency: "USDT",
		onlyShowIfBalanceGreaterThan: 1,
		updateInterval: 1000,
		deposited: {},
	},

	getStyles: function() {
		return [this.file("css/styles.css")];
	},

	start: function() {
		this.loaded = false;
		this.updateTimer = null;
		this.cryptoData = {
			assets: [],
			totalBalance: 0
		};
		this.ROIs = [];
	},

	getDom: function() {
		let elem = document.createElement("div");
		if (!this.config.apiKey || !this.config.apiSecret) {
			elem.classList.add("loading");
			elem.classList.add("small");
			elem.innerHTML += "Please provide an API key and Secret Key";
			return elem;
		}
		
		if (!this.loaded) {
			elem.classList.add("loading");
			elem.classList.add("small");
			elem.innerHTML += "Loading &hellip;";
			return elem;
		}
		
		let table = document.createElement("table");
		let numberItems = Math.min(this.config.maxItems, this.cryptoData.assets.length)
		let tbody = document.createElement("tbody");
		for (let i = 0; i < numberItems; i++) {
			let asset = this.cryptoData.assets[i];
			let row = document.createElement("tr");
			row.classList.add(this.config.fontSize);
			
			// logo, symbol, value, usdPrice, balance
			let columns = ["symbol", "value", "usdPrice", "balance", "roi"];
			for (let i = 0; i < columns.length; i++){
				row.appendChild(this.getCell(columns[i], asset));
			}
			tbody.appendChild(row);
		}
		// last row
		// logo: empty, symbol: Total balance, value: empty, usdPrice: empty, balance: totalBalance
		table.appendChild(this.getTableHeader());
		table.appendChild(tbody);
		table.appendChild(this.getTableFooter());
		elem.appendChild(table);
		return elem;
	},
	
	getColumns: function () {
		return ["Symbol", "Value", `Price/${this.config.quoteCurrency}`, `Balance/${this.config.quoteCurrency}`, 'ROI']
	},
	
	getTableHeader: function() {
		let header = document.createElement("thead");
		let row = document.createElement("tr");
		row.classList.add(this.config.fontSize);
		let columns = this.getColumns();
		for (let i = 0; i < columns.length; i++) {
			let cell = document.createElement("th");
			cell.innerHTML = columns[i];
			row.appendChild(cell);
		}
		header.appendChild(row);
		return header;
	},
	
	getTableFooter: function() {
		let footer = document.createElement("tfoot");
		let row = document.createElement("tr");
		row.classList.add(this.config.fontSize);
		let columns = this.getColumns();
		for(let i = 0; i < columns.length; i++){
			let cell = document.createElement("td");
			if (i === 0) cell.innerHTML = "Total balance";
			else if (i === 3) cell.innerHTML = this.cryptoData.totalBalance.toFixed(2);
			else if (i === 4) {
				let symbolsDep = Object.keys(this.config.deposited);
				let assets2 = this.cryptoData.assets.filter(asset => symbolsDep.includes(asset.symbol))
				let totalDep = 0, totalBalance = 0;
				for(let i = 0; i < this.ROIs.length; i++) {
					totalDep += this.ROIs[i].totalDep
				}
				for(let i = 0; i < assets2.length; i++) {
					totalBalance += assets2[i].balance;
				}
				if (totalBalance === 0) {
					cell.innerHTML = "100%"
				} else {
					cell.innerHTML = `${(totalDep/totalBalance*100).toFixed(2)}%`;
					if (totalDep/totalBalance < 1) cell.classList.add("negative");
					else cell.classList.add("positive");
				}
			}
			row.appendChild(cell);
		}
		footer.appendChild(row);
		return footer;
	},
	
	getCell: function (colType, asset) {
		let {symbol, value, usdPrice, balance} = asset;
		let cell = document.createElement("td");
		switch (colType) {
		case "symbol":
			cell.classList.add("cell-" + colType);
			cell.innerHTML = symbol;
			break;
		case "value":
			cell.classList.add("cell-" + colType);
			cell.innerHTML = value.toFixed(4);
			break;
		case "usdPrice":
			cell.classList.add("cell-usd-price");
			cell.innerHTML = usdPrice.toFixed(2);
			break;
		case "balance":
			cell.classList.add("cell-" + colType);
			cell.innerHTML = balance.toFixed(2);
			break;
		case "roi":
			cell.classList.add("cell-" + colType);
			if (this.config.deposited.hasOwnProperty(symbol) && Array.isArray(this.config.deposited[symbol])) {
				let deposited = this.config.deposited[symbol]
				let totalDep = 0;
				for(let i = 0; i < deposited.length; i++){
					if (deposited[i].hasOwnProperty('amount') && deposited[i].hasOwnProperty('buyAtPrice')){
						totalDep += deposited[i]['amount'] * deposited[i]['buyAtPrice'];
					}
				}
				cell.innerHTML = `${(totalDep/balance*100).toFixed(2)}%`;
				if (totalDep/balance < 1) cell.classList.add("negative");
				else cell.classList.add("positive");
				this.ROIs.push({
					symbol: symbol,
					totalDep: totalDep,
					roi: totalDep/balance
				})
			} else {
				cell.innerHTML = "100%";
			}
			break;
		default:
        	cell.innerHTML = " ";
		}
		return cell;
	},

	notificationReceived: function(notification, payload, sender) {
		console.log("Notification received:", notification, payload, sender)
		switch(notification) {
			case "DOM_OBJECTS_CREATED":
				this.scheduleUpdate();
				break;
			}
	},
	
	suspend: function () {
		console.log("MMM-Binance is suspend");
		this.loaded = false;
		if (this.updateTimer) {
			clearInterval(this.updateTimer);
		}
	},
	
	resume: function () {
		console.log("MMM-Binance is resumed");
		this.scheduleUpdate();
	},
	
	scheduleUpdate: function () {
		if (this.updateTimer) {
			clearInterval(this.updateTimer);
		}
		this.updateTimer = setInterval(() => {
			this.sendSocketNotification("GET_BALANCES", {apiKey: this.config.apiKey, apiSecret: this.config.apiSecret, quoteCurrency: this.config.quoteCurrency});
		}, this.config.updateInterval);
	},

	socketNotificationReceived: function(notification, payload) {
		switch(notification) {
			case "RETURN_BALANCES":
				payload.assets = payload.assets.filter(x => x.balance >= this.config.onlyShowIfBalanceGreaterThan)
				this.cryptoData = payload;
				this.cryptoData.assets.sort((a, b) => a.balance - b.balance).reverse();
				this.loaded = true;
				this.ROIs = [];
				this.updateDom();
				break;
			case "LOG_ERROR":
				console.error(payload);
				break;
		}
	},
});

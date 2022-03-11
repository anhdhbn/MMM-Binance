const NodeHelper = require("node_helper");
const Binance = require('node-binance-api');

module.exports = NodeHelper.create({
	start: () => {},
	socketNotificationReceived: function(notification, payload) {
		switch(notification) {
			case "GET_BALANCES":
				this.getBalances(payload);
				break;
			}
	},
	getBalances: function(payload) {
		let quoteCurrency = payload.quoteCurrency;
		const binance = new Binance().options({
			  APIKEY: payload.apiKey,
			  APISECRET: payload.apiSecret
		});
		binance.prices((error, data) => {
			if ( error ) return this.sendSocketNotification("LOG_ERROR", error);
			binance.balance((error, balances)=>{
				let result = {
					assets: [],
					totalBalance: 0
				}
				if ( error ) return this.sendSocketNotification("LOG_ERROR", error);
				for (const currency in balances){
					let asset = balances[currency]
					asset.available = parseFloat(asset.available)
					asset.onOrder = parseFloat(asset.onOrder)
					let assetValue = asset.available + asset.onOrder;

					if (assetValue > 0){
						let usdPrice = 1;
						if (currency == quoteCurrency){
							result.totalBalance += assetValue;
						}
						else {
							let pair = '';
							if (currency == 'BETH') pair = `ETH${quoteCurrency}`
							else if (currency == 'LDBNB') pair = `BNB${quoteCurrency}`
							else pair = `${currency}${quoteCurrency}`
							if (data.hasOwnProperty(pair)) {
								usdPrice = parseFloat(data[pair]);
								result.totalBalance += assetValue * usdPrice;
							} else {
								this.sendSocketNotification("LOG_ERROR", `Pair: ${pair} not found`);
							}
						}
						result.assets.push({
							symbol: currency,
							value: assetValue,
							usdPrice: usdPrice,
							balance: assetValue * usdPrice
						});
					}
				}
				this.sendSocketNotification("RETURN_BALANCES", result);
			})
		})
	}
});

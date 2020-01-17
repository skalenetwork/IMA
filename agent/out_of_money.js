( function () {
    "use strict";
    let this_module = this;

    this_module.BigNumber = require( "big-number" );

    class OutOfMoneyHelper extends EventDispatcher {
        constructor( strDisplayName, w3, strAccountAddress, strNetworkName, chainID, bnLowBalance ) {
            super();
            this.strDisplayName = strDisplayName;
            this.w3 = w3;
            this.strAccountAddress = strAccountAddress;
            this.strNetworkName = strNetworkName;
            this.chainID = chainID;
            this.bnLowBalance = bnLowBalance;
        }
        async checkBalance() {
            let balance = new this_module.BigNumber( await this.w3.eth.getBalance( this.strAccountAddress ) );
            console.log( "Balance active value is ", balance.toString() );
            console.log( "Balance margin value is ", this.bnLowBalance.toString() );
            let isLowBalance = balance.lte( this.bnLowBalance ) ? true : false;
            ///////isLowBalance = true; // debug
            console.log( "Low balance check is", isLowBalance );
            if( isLowBalance ) {
                this.dispatchEvent( new CustomEvent( "balance.warning", { "w3": this.w3, "details": {
                    "displayName": this.strDisplayName
                    , "accountAddress": this.strAccountAddress
                    , "networkName": this.strNetworkName
                    , "cid": this.chainID3
                    , "balance": balance.toString()
                    , "lowBalanceMargin": this.bnLowBalance.toString()
                } } ) );
            }
        }
    };
    this_module.OutOfMoneyHelper = OutOfMoneyHelper;

} ).call( this );


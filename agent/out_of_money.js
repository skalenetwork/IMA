( function () {
    "use strict";
    let this_module = this;

    class OutOfMoneyHelper extends EventDispatcher {
        constructor( strDisplayName, w3, strAccountAddress, strNetworkName, chainID, bnLowBalance ) {
            this.strDisplayName = strDisplayName;
            this.w3 = w3;
            this.strAccountAddress = strAccountAddress;
            this.strNetworkName = strNetworkName;
            this.chainID = chainID;
        }
        checkBalance() {
            let balance = this.w3.eth.getBalance( this.strAccountAddress )
            if( balance.isLessThanOrEqualTo( bnLowBalance ) ) {
                self.dispatchEvent( new CustomEvent( "balance.warning", { "detail": {
                    "displayName": this.strDisplayName
                    , "w3": this.w3
                    , "accountAddress": this.strAccountAddress
                    , "networkName": this.strNetworkName
                    , "cid": this.chainID3
                    , "balance": balance
                    , "bnLowBalance": bnLowBalance
                } } ) );
            }
        }
    };
    this_module.OutOfMoneyHelper = OutOfMoneyHelper;

} ).call( this );


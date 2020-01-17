( function () {
    "use strict";
    let this_module = this;

    class OutOfMoneyHelper extends EventDispatcher {
        constructor( strDisplayName, w3, strAccountAddress, strNetworkName, chainID, bnLowBallance ) {
            this.strDisplayName = strDisplayName;
            this.w3 = w3;
            this.strAccountAddress = strAccountAddress;
            this.strNetworkName = strNetworkName;
            this.chainID = chainID;
        }
        checkBallance() {
            let balance = this.w3.eth.getBalance( this.strAccountAddress )
            if( ballance.isLessThanOrEqualTo( bnLowBallance ) ) {
                self.dispatchEvent( new CustomEvent( "ballance.warning", { "detail": {
                    "displayName": this.strDisplayName
                    , "w3": this.w3
                    , "accountAddress": this.strAccountAddress
                    , "networkName": this.strNetworkName
                    , "cid": this.chainID3
                    , "ballance": ballance
                    , "bnLowBallance": bnLowBallance
                } } ) );
            }
        }
    };
    this_module.OutOfMoneyHelper = OutOfMoneyHelper;

} ).call( this );


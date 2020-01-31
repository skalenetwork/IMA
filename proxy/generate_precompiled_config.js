const imaUtils = require( "../agent/utils.js" );
const log = require( "../npms/skale-log/log.js" );
const cc = log.cc;
//cc.enable( true );
cc.enable( false );
log.addStdout();

let g_bVerbose = false;

let ownerAddress = "0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852"; // "0x9e7f3c7e85b104415b2ac3b7436fc956c3100aae";

let g_arrExampleAuthorizedCallers = [
    {
        private_key: "3fbe6562ab00cd22bac8fc07894ba0d926911dc8f39fceb3d16ca7fd73eca578",
        address: "0x0cfc13004ecabaae53612e7f69a687332da33c5b",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Aldo",
        gender: "male",
        public_key: "f23f7d77fc90f2b6ad68a5a867d10f9d1099b674269025930dd6318091694ba43f4dc7943189e42eca103fff3eef6eab6bdeea911eaaca2251546810e82f8b3a"
    },
    {
        private_key: "43ea8b9229ed629a5200d69e179ebb6fcf4b8452c56be32493fc34681d0c056f",
        address: "0xb3c2109aad584ed68ecb7845f43b366ec4bbe12b",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Bear",
        gender: "male",
        public_key: "60c720d5210e5ff140ad31b013b337615274d2bae751764c331e22ff2ba4d883ad8d0e5e97d2943e573edb29d611989d5cb7ba9fd8a323744d298d549b09b55f"
    },
    {
        private_key: "80b97f809316916b06f615b9e3879301afdb3686ffd088d66c74612c118660c3",
        address: "0x209f63dafaf359baf59d05cab76b30ebe0f8c296",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Toby",
        gender: "male",
        public_key: "45b3a6358a7db8d2d99e42f4cfd6396625edff66ac53cf939352129d3e8f264e43e17ba4351bef184f75c94cae231ba98c0f0f212704047b31c18605bf31b7b1"
    },
    {
        private_key: "ae0ecf0dbd226f23850c993ab09e58aa8c357839730b9af02c92a333dcb1c7bd",
        address: "0x8f3893cf6ad4a4b0511579f19bf54714485bf517",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Teddy",
        gender: "male",
        public_key: "64c342ec4807b57017c377ac0fa8ae28f5fcda4f44a3f691a43b78379a15e6f5a467e49d098be278931f7009b6ee8a9b0d39cc590a210b939b942f65b6cae92e"
    },
    {
        private_key: "c5c1b12ebf488930d9bb04c465378e926bcdf77f0a3ab80b88880f04d0c36b39",
        address: "0x37aeca788d41ce41f8a59833328aee86fd690f2d",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Zeus",
        gender: "male",
        public_key: "c62851b8d964ed2cdc8aa996f22bd11ba7a84ed6a93d930a8638943a1eb2088b137523a0ae40e55ff756495955b31e509f1f34e8bf961a8620ed2feb3ad94e4d"
    },
    {
        private_key: "ad8ada971c7674601ee7480ce6984bf49f3e5ac1365ed79ca241cf67e10968a0",
        address: "0x09055a70f685ff3e01d4b48fd360bd4be1f4bab9",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Louie",
        gender: "male",
        public_key: "7b3eb24f2bab12b3ab76433d43a33e64e52f6cfeb8697a73aa06173d5ac617e57c2db27aa1725cc5b49c9f62ab2364ea21cde933204bce5f0571cdbc0d35fd8e"
    },
    {
        private_key: "c183afa307709de28bb74488c64af517c72e5cb3a9ec1e6be13165602aee4fac",
        address: "0x155725701232a3504dae7d92823a00195b6d7607",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Murphy",
        gender: "male",
        public_key: "b4d2f94ccb0c378aeb5a404882ce900250e9db545ecbb691b05070071b13524506d78529ef2ddaed062664f2ec2535446e82f6e08e876b9412bfabeb67079298"
    },
    {
        private_key: "f702e5f80e8507f00c69c2256d5905da25363ed20cdfafcf2aee736add693691",
        address: "0xb302e3781eddfc29cc9c5197bb03db16dc60720c",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Henry",
        gender: "male",
        public_key: "d919ef5406508ff725a8fca569772e8b90bd7b01bf8fcfeae0f6fe24a1be341f5b4e01b35c31b0d4cde0cf86b9a1bc28008cc3f769719af3351ccacdd1ff4029"
    },
    {
        private_key: "94a980b768924c1928e19757df2f23eb894e584a5d67eb76963d8bf41279f690",
        address: "0xcb96d5dd8543e54f57b5a6366e03dd6d9472a56e",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Ollie",
        gender: "male",
        public_key: "832007b6ec407942a2f65e5f63bada823a70bf31857ab475c6556240e00264484efd0135619498c8c5f68ff8af5d3f89ddb3924dc2a0c79d0d49e6d857073901"
    },
    {
        private_key: "9a89e3767477a85ab047ba347f3079bda6cb311f05ee8b2ed7d678f551549a8c",
        address: "0x66d46c00f61a4a1c267f49f8bf44b87f09a7c518",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Oscar",
        gender: "male",
        public_key: "e5dcd67f5fbfac49a6231b0d00d37bf87e9718aa9b57dbbe5bbb8c95d550fb505b951decda44bda8cc0968e2b87dce271a5384ab753a7448ee5acf8c0190b973"
    },
    {
        private_key: "ab52690b69d4f443d26ed79d5d308517d73f12ac10c1d396142a2cec711a75c3",
        address: "0x250ff7df7be96e967cec5a650644a7fadfcf89f7",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Finn",
        gender: "male",
        public_key: "a27d29c406c6e9311782f8258cd7c6c819987cbde7744cd84761e52cddf1b89897c9048fd29b175ff959d7362bea056524ef420e9337d1322385b633931b456f"
    },
    {
        private_key: "080da5451389df533e0c5f5e528860fa095810a5475e9347cf114010c8cd8e33",
        address: "0x845f94a7e7e96e8a5c66530a372b5c633cf036ff",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Lucky",
        gender: "male",
        public_key: "4f6a7f108b000f0c28f0104d9529c6a6a637f576a3d676d34d8e5e289d3fa4eb879fb1765d3b4a24dcc6ec61f5303e7d0de38e674ebaf94613cfffb1cb12ca16"
    },
    {
        private_key: "7e630eab2ede23152c3141266ff9a6f351d39211198e3b86f3bdbb3e1cb3fcaf",
        address: "0xc1fff3def325fc8e300e97612da4fed6c1e5cbc3",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Sam",
        gender: "male",
        public_key: "028662ede4042653f918dc2c37d7cfdc4d6d6c58bbf18f19d08b9c2c628da1b426da2258bb808460375a99edf9734873ec982ae8f6d456f33c735e98607e9c93"
    },
    {
        private_key: "afb738d06513fd339665c0ffa8dcd2d7814cc8d7925d316b1f0b9c46e3cba4b3",
        address: "0xcdaaba5c01180232ba59eb2e63f24d433d7aedb9",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Beau",
        gender: "male",
        public_key: "2034f339efcb56d00808d85f9e3f824f1f1628b523431a632a5b750096b311f35e8052ab6118a93708841429e474a0b39f3f8aa9da691f5e8d7f225e79b8026e"
    },
    {
        private_key: "0a4fafbcf22f5e69a259b15376c62195d49b08cd6301e83de51926287818f304",
        address: "0x29bbccaae4a8d0bad09e54e43fac2a7520eaf535",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Jasper",
        gender: "male",
        public_key: "f390b97a1e41de288e995efe9636509879d9701855cc03af2b2a671df01ed3bddd22974857989ef1e0b36e4df898a0dd04058d40ba5647da1cbe5170f20df017"
    },
    {
        private_key: "990e241fce19a1f93ba2f99e0b3902624c8ac17c0ecc11b69184ac465635ea95",
        address: "0x58356bde171397d2dbba5b8956a8cd02f9d50465",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Thor",
        gender: "male",
        public_key: "c48e085e93fd08af19db0d4087b002638c323247b0fa75f79935ca2e25ba1c05303114ec68b2d0a94845838a4edb04abeb91f8b82d0ed9465a6cf23e6172de3c"
    },
    {
        private_key: "397ce9ae5ea353a85f71a0679d9fd733cd4a0fd26f4e4226edc4f91043b86eaa",
        address: "0x64a8ca2babc2400c48019e9a9909355a3cd26573",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Apollo",
        gender: "male",
        public_key: "bf8457749e60914eb0853b0402c90db59346f7e5b2ba1b41c56c5d62ac5832597e2bb6a32776ab78e8f49ca42e934b42d76b1893227da0b514ba744e373f8820"
    },
    {
        private_key: "86a895ec033fe62bb68419e943c064decee8c9f1b972894d44b387bd61ce9e6c",
        address: "0x985eeb1f90c850ff347074975e2349432aed8b21",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Shadow",
        gender: "male",
        public_key: "f34a5f1f81f6eb8e3ed8ea12efa2110a656e79fa7d5fba9767977d95d08057e2e7e678bd92f63db5e120194a42f2b0eaed6f96997f59d4423750e2af79d6cb1d"
    },
    {
        private_key: "baef06ca9f68e05ffbe8882c7e5b67a6fe27867bf0427967e18af79336799ea7",
        address: "0xc8a02618206124ee29388622fcf1338db20cd461",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Otis",
        gender: "male",
        public_key: "2537ed3b7eb49053a86e6a315b84e1e79355cb9ca74ca2979c5de834f8c66f62aad2c382163226f0c1fb0b656f9dfca4ca5824dae99bdb6efa715aaa27ffd634"
    },
    {
        private_key: "56c390610eade85342b9af96dd59dbb84cf300d067b85e37144a338d31121fca",
        address: "0x66f72c5d737c4230b5658589a4e241bb941bce0a",
        type: "rich cat",
        balance: "1000000000000000000000000000000",
        name: "Rocco",
        gender: "male",
        public_key: "c67f8434bcc11569aa0f70fd6ef1d8349ae778dba1980bd0661cc4672c01ecead50ef465ac2ffe73e81e4da4858cfaf3388a5dda7b3fa5de3328b2023a6f1f84"
    }
];

let g_arrContracts = [
    {
        fileName: "SkaleFeatures.json"
        , address: "0xc033b369416c9ecd8e4a07aafa8b06b4107419e2"
        , referenceVariableName: "skaleFeaturesAddress"
    } , {
        fileName: "LockAndDataForSchain.json"
        , address: "0x47cf4c2d6891377952a7e0e08a6f17180a91a0f9"
        , referenceVariableName: "lockAndDataAddress"
    }, {
        fileName: "MessageProxyForSchain.json"
        , address: "0x427c74e358eb1f620e71f64afc9b1b5d2309dd01"
        , referenceVariableName: "messageProxyAddress"
    }, {
        fileName: "TokenManager.json"
        , address: "0x57ad607c6e90df7d7f158985c3e436007a15d744"
        , referenceVariableName: "tokenManagerAddress"
    }, {
        fileName: "EthERC20.json"
        , address: "0xd3cdbc1b727b2ed91b8ad21333841d2e96f255af"
        , referenceVariableName: "ethERC20Address"
    }, {
        fileName: "ERC20ModuleForSchain.json"
        , address: "0xc30516c1dedfa91a948349209da6d6b1c8868ed7"
        , referenceVariableName: "erc20ModuleForSchainAddress"
    }, {
        fileName: "ERC721ModuleForSchain.json"
        , address: "0xc1b336da9058efd1e9f5636a70bfe2ec17e15abb"
        , referenceVariableName: "erc721ModuleForSchainAddress"
    }, {
        fileName: "LockAndDataForSchainERC20.json"
        , address: "0xc7085eb0ba5c2d449e80c22d6da8f0edbb86dd82"
        , referenceVariableName: "lockAndDataForSchainERC20Address"
    }, {
        fileName: "LockAndDataForSchainERC721.json"
        , address: "0x97438fdfbdcc4ccc533ea874bfeb71f4098585ab"
        , referenceVariableName: "lockAndDataForSchainERC721Address"
    }, {
        fileName: "TokenFactory.json"
        , address: "0xe9e8e031685137c3014793bef2875419c304aa72"
        , referenceVariableName: "tokenFactoryAddress"
    }
];
//proxyForSchainAddress

let g_joSummaryABI = {};

let g_joSkaleConfigTemplate = {
    "accounts": {
    },
    skaleConfig: {
        contractSettings: {
            common: {
                enableContractLogMessages: false
            }, IMA: {
                ownerAddress: ownerAddress,
                variables: {
                    LockAndDataForSchain: {
                        permitted: {
                        }
                    },
                    MessageProxyForSchain: {
                        mapAuthorizedCallers: {
                        } 
                    }
                }
            }
        }
    }
};

g_joSkaleConfigTemplate.skaleConfig.contractSettings.IMA.variables.MessageProxyForSchain.mapAuthorizedCallers[ ownerAddress ] = 1;

function convert_camel_case_to_underscore_case( s ) {
    return ( typeof s == "string" ) ? s.replace(/\.?([A-Z])/g, function (x,y){return "_" + y.toLowerCase()}).replace(/^_/, "") : s;
}

for( let idxContract = 0; idxContract < g_arrContracts.length; ++ idxContract ) {
    let joContractProperties = g_arrContracts[ idxContract ];
    if( g_bVerbose )
        log.write( cc.normal("Processing contract ") + cc.info(joContractProperties.fileName) + cc.normal("...") + "\n" );
    let joContractBuildInfo = imaUtils.jsonFileLoad( imaUtils.normalizePath( __dirname + "/build/contracts/" + joContractProperties.fileName ) );
    if( g_bVerbose ) {
        log.write( cc.normal("    Contract name is ") + cc.notice(joContractBuildInfo.contractName)  + "\n" );
        log.write( cc.normal("    Runtime byte-code string length is ") + cc.notice(joContractBuildInfo.deployedBytecode.length)  + "\n" );
    }
    g_joSkaleConfigTemplate.accounts[ joContractProperties.address ] = {
        "balance": "0",
        "nonce": "0",
        "storage": {},
        "code": joContractBuildInfo.deployedBytecode
    };
    g_joSkaleConfigTemplate.skaleConfig.contractSettings.IMA[ joContractProperties.referenceVariableName ] = joContractProperties.address;
    g_joSkaleConfigTemplate.skaleConfig.contractSettings.IMA.variables.LockAndDataForSchain.permitted[ joContractBuildInfo.contractName ] = joContractProperties.address;
    g_joSkaleConfigTemplate.skaleConfig.contractSettings.IMA.variables.MessageProxyForSchain.mapAuthorizedCallers[ joContractProperties.address ] = 1;
    //
    let strContractNameCamelCase = joContractProperties.fileName.replace( ".json", "" );
    let strContractNameUnderscoreCase = convert_camel_case_to_underscore_case( strContractNameCamelCase ).replace( "e_r_c", "erc" );
    if( strContractNameUnderscoreCase == "message_proxy" || strContractNameUnderscoreCase == "message_proxy_for_schain" )
        strContractNameUnderscoreCase = "message_proxy_chain"; // message_proxy -> message_proxy_chain
    g_joSummaryABI[ "" + strContractNameUnderscoreCase + "_address" ] = "" + joContractProperties.address;
    g_joSummaryABI[ "" + strContractNameUnderscoreCase + "_abi" ] = joContractBuildInfo.abi;
    if( g_bVerbose )
        log.write( cc.success("Done") + "\n" );
}

for( let idxAuthorizedCaller = 0; idxAuthorizedCaller < g_arrExampleAuthorizedCallers.length; ++ idxAuthorizedCaller ) {
    let joExampleAuthorizedCaller = g_arrExampleAuthorizedCallers[ idxAuthorizedCaller ];
    g_joSkaleConfigTemplate.skaleConfig.contractSettings.IMA.variables.MessageProxyForSchain.mapAuthorizedCallers[ joExampleAuthorizedCaller.address ] = 1;
}




//log.write( cc.success("Done, generated skaled config data: ") + cc.j(g_joSkaleConfigTemplate) + "\n" );
//log.write( cc.success("Done, generated skaled config data: ") + cc.j(JSON.stringify( g_joSkaleConfigTemplate, null, 4 ) ) + "\n" );
console.log( "Done, generated skaled config data: " + JSON.stringify( g_joSkaleConfigTemplate, null, 4 ) );

// console.log( "Done, generated ABI summary: " + JSON.stringify( g_joSummaryABI, null, 4 ) );

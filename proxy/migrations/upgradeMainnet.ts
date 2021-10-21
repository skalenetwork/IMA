import { contracts } from "./deployMainnet";
import { upgrade } from "./upgrade";


async function main() {
    await upgrade(
        "1.1.0",
        contracts,
        async ( safeTransactions, abi ) => undefined,
        async ( safeTransactions, abi ) => undefined,
        "proxyMainnet"
    );
}

if( require.main === module ) {
    main()
        .then( () => process.exit( 0 ) )
        .catch( error => {
            console.error( error );
            process.exit( 1 );
        } );
}

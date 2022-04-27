import { promises as fs } from "fs";
import chalk from "chalk";
import { importAddresses, generateManifest } from "./generateManifest";

export async function change() {

    if( !process.env.ABI ) {
        console.log( chalk.red( "Set path to file with ABI and addresses to ABI environment variables" ) );
        return;
    }

    if( !process.env.MANIFEST ) {
        console.log( chalk.red( "Set path to file with Manifest to MANIFEST environment variables" ) );
        return;
    }

    const abiFilename = process.env.ABI;
    const manifestFilename = process.env.MANIFEST;
    const currentAbi = JSON.parse( await fs.readFile( abiFilename, "utf-8" ) );
    const currentManifest = JSON.parse( await fs.readFile( manifestFilename, "utf-8" ) );

    const addresses = await importAddresses( currentManifest, currentAbi );
    const newManifest = await generateManifest( addresses );
    return newManifest;
}

if( require.main === module ) {
    change()
        .then( () => process.exit( 0 ) )
        .catch( error => {
            console.error( error );
            process.exit( 1 );
        } );
}

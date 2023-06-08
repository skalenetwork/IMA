// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * SKALE IMA is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * SKALE IMA is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file imaGasUsageOperations.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";
import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";

export function composeGasUsageReportFromArray( strName, jarrReceipts ) {
    if( ! ( strName && typeof strName == "string" && jarrReceipts ) )
        return "";
    let i, sumGasUsed = owaspUtils.toBN( "0" ),
        s = "\n" + cc.info( "Gas usage report for " ) + cc.attention( strName ) + "\n";
    for( i = 0; i < jarrReceipts.length; ++ i ) {
        try {
            sumGasUsed = sumGasUsed.add( owaspUtils.toBN( jarrReceipts[i].receipt.gasUsed ) );
            s += "    " + cc.notice( jarrReceipts[i].description ) + cc.debug( "....." ) +
                cc.info( jarrReceipts[i].receipt.gasUsed.toString() ) + "\n";
        } catch ( err ) { }
    }
    s += "    " + cc.attention( "SUM" ) + cc.debug( "....." ) +
        cc.info( sumGasUsed.toString() ) + "\n";
    return { "sumGasUsed": sumGasUsed, "strReport": s };
}

export function printGasUsageReportFromArray( strName, jarrReceipts, details ) {
    if( log.verboseGet() >= log.verboseReversed().notice ) {
        details = details || log;
        const jo = composeGasUsageReportFromArray( strName, jarrReceipts );
        if( jo.strReport &&
            typeof jo.strReport == "string" &&
            jo.strReport.length > 0 &&
            jo.sumGasUsed &&
            jo.sumGasUsed.gt( owaspUtils.toBN( "0" ) )
        )
            log.write( jo.strReport );
    }
}

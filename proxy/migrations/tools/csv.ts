import csv from "csv-parser";
import fs from "fs";

export async function read(file: string) {
    const csvRead = fs.createReadStream(file).pipe(csv());
    const csvWait = new Promise((resolve, reject) => {
        const results = [] as any[];
        csvRead.on('data', (data) => results.push(data)).on('end', () => resolve(results));
        return results;
    });
    return await csvWait;
}
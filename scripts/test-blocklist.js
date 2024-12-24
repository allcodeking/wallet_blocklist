import fs from 'fs';
import path from 'path';
 
export function testBlocklist(updatedBlocklist, type, baseDir) {
    if (type === 'domain') {
        const directoryPath = path.resolve(baseDir, 'resources', 'domains');
        const files = fs.readdirSync(directoryPath).filter(file => file.endsWith('.txt'));
        const bypass = new Set([
            // These are bypassed in the metamask list
            "mystrikingly.com",
            "simdif.com",
            "gb.net",
            "btcs.love",
            "ferozo.com",
            "im-creator.com",
            "free-ethereum.io",
            "890m.com",
            "b5z.net",
            "test.com",
            "multichain.org", // https://twitter.com/MultichainOrg/status/1677180114227056641
            "dydx.exchange", // https://x.com/dydx/status/1815780835473129702
            "ambient.finance", // https://x.com/pcaversaccio/status/1846851269207392722
            "xyz.cutestat.com",
            // We need to go back and check these
            "azureserv.com",
            "dnset.com",
            "dnsrd.com",
            "prohoster.biz",
            "kucoin.plus",
            "ewp.live",
            "sdstarfx.com",
            "1mobile.com",
            "v6.rocks",
            "linkpc.net",
            "bookmanga.com",
            "lihi.cc",
            "mytradift.com",
            "anondns.net",
            "bitkeep.vip",
            "temporary.site",
            "misecure.com",
            "myz.info",
            "ton-claim.org",
            "servehalflife.com",
            "earnstations.com",
            "web3quests.com",
            "qubitscube.com",
            "teknik.io",
            "nflfan.org",
            "purworejokab.go.id",
            "ditchain.org",
            "kuex.com",
            "cloud.dbank.com",
            "bybi75-alternate.app.link",
            "mz4t6.rdtk.io",
            "ether.fi", // https://x.com/ether_fi/status/1838643492102283571
            // We currently block ipfs gateways at the domain level
            'dweb.link',
            'infura-ipfs.io',
            'ipfs.io',
            // These are on our list only, need to investigate
            'ltcminer.com',
            'usermd.net',
            'tw1.ru',
            ]);

        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const data = fs.readFileSync(filePath, 'utf8');
            const domains = data.split('\n').map(domain => domain.trim());
            const filteredDomains = domains.filter(domain => !bypass.has(domain));
            const foundDomain = updatedBlocklist.find(domain => filteredDomains.includes(domain));
            if (foundDomain) {
                return foundDomain;
            }
        }
        return;
    }
    else if (type === 'package') {
        const recognizedPackagePath = path.resolve(baseDir, 'resources', 'recognized_packages.txt');

        const data = fs.readFileSync(recognizedPackagePath, 'utf8');
        const packages = data.split('\n').map(pkg => pkg.trim());
        packages.push('0x0000000000000000000000000000000000000000000000000000000000000002', 
                      '0x000000000000000000000000000000000000000000000000000000000000000b',
                      '0x0000000000000000000000000000000000000000000000000000000000000003');
        const foundPackage = updatedBlocklist.find(pkg => packages.includes(pkg));
        if (foundPackage) {
            return foundPackage;
        }
        return;
    }
    else {
        const recognizedPackagePath = path.resolve(baseDir, 'resources', 'recognized_packages.txt');

        const data = fs.readFileSync(recognizedPackagePath, 'utf8');
        const packages = data.split('\n').map(pkg => pkg.trim());
        const foundType = updatedBlocklist.find(pkg => {
            const [firstElement] = pkg.split('::');
            return packages.includes(firstElement);
        });
        if (foundType) {
            return foundType;
        }
        return;
    }
}

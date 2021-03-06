#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const { debugLog, run } = require('./common');

const main = async args => {
	let resp;
	try {
		/*
		// Not needed: https://stackoverflow.com/a/37927943/12547142
		
		const cwd = process.cwd();
		debugLog('Current working directory:', cwd);

		resp = await run('git', ['rev-parse', '--show-toplevel']);
		const root = resp.stdout.trim();
		debugLog('Repository root directory:', root);
		
		// Ensuring the current working directory is at the repository root
		// ...
		*/

		const root = process.cwd();

		debugLog('Inside update-version hook.');
		debugLog('Command-line arguments:', args);

		const remoteName = args[0];
		debugLog('Remote:', remoteName);

		debugLog('Fetching tags...');
		await run('git', ['fetch', '--tags', remoteName]);

		debugLog('Retrieving the latest tag version...');
		resp = await run('git', ['rev-list', '--tags', '--max-count=1']);
		const latestTagCommit = resp.stdout.trim();
		debugLog('Latest tag commit hash:', latestTagCommit);

		resp = await run('git', ['describe', '--tags', latestTagCommit]);
		const latestTag = resp.stdout.trim();
		debugLog('Latest tag:', latestTag);
		const latestVersion = latestTag.slice(1);
		debugLog('=> Latest version:', latestVersion);

		debugLog('Retrieving the version from package.json...');
		const package = require('../package.json');
		const lockfile = require('../package-lock.json');
		const { version: packageVersion } = package;
		const { version: lockfileVersion } = lockfile;
		const {
			packages: {
				'': { version: lockfileVersion2 }
			}
		} = lockfile;
		debugLog('package.json version:', packageVersion);
		debugLog('package-lock.json version:', lockfileVersion);
		debugLog('package-lock.json version (repeated):', lockfileVersion2);

		let success =
			latestVersion === packageVersion &&
			latestVersion === lockfileVersion &&
			latestVersion === lockfileVersion2;

		if (success) {
			debugLog('Versions match. No update needed.');
		} else {
			await run('git', ['tag', '-d', latestTag]);
			debugLog("Versions donn't match. Updating versions.");
			if (packageVersion !== latestVersion) {
				console.log(
					'Updating package.json with version from latest tag...'
				);
				package.version = latestVersion;
				fs.writeFileSync(
					path.join(root, 'package.json'),
					JSON.stringify(package, null, '\t')
				);
				debugLog('Updated package.json.');
			}
			if (lockfileVersion !== latestVersion) {
				console.log(
					'Updating package-lock.json with version from latest tag...'
				);
				lockfile.version = latestVersion;
				fs.writeFileSync(
					path.join(root, 'package-lock.json'),
					JSON.stringify(lockfile, null, '\t')
				);
				debugLog('Updated package-lock.json.');
			}
			if (lockfileVersion2 !== latestVersion) {
				console.log(
					'Updating package-lock.json (repeated) with version from latest tag...'
				);
				lockfile.packages[''].version = latestVersion;
				fs.writeFileSync(
					path.join(root, 'package-lock.json'),
					JSON.stringify(lockfile, null, '\t')
				);
				debugLog('Updated package-lock.json (repeated).');
			}
			debugLog('Updated versions.');
			await run('git', ['add', 'package.json']);
			await run('git', ['add', 'package-lock.json']);
			await run('git', [
				'commit',
				'-m',
				'Updating version to ' + latestTag
			]);
			await run('git', ['tag', latestTag]);

			resp = await run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
			const currentBranch = resp.stdout.trim();
			debugLog('Current branch:', currentBranch);

			process.stderr.write(
				'\033[0;31mYour push has been rejected in order to update the versions in package.json and package-lock.json according to the latest tag.\033[0m\n'
			);
			process.stderr.write(
				'\033[0;32mPush again with: \033[0mgit push ' +
					remoteName +
					' ' +
					currentBranch +
					' ' +
					latestTag +
					'\n'
			);
		}
		return process.exit(success ? 0 : 1);
	} catch (e) {
		e && e.data && e.data.signal && debugLog('Signal:', e.data.signal);
		e &&
			e.data &&
			e.data.stdout &&
			debugLog(
				'stdout:',
				'\n----------------------',
				e.data.stdout,
				'\n----------------------'
			);
		console.error(e.message);
		process.exit(e.exit);
	}
};

module.exports = { main };

if (require.main === module) {
	main(process.argv.slice(2));
}

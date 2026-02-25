/*

* About File:
	this is already documented but it defines the languages supported, extensions, runners, coloring, etc

*/

import { basename } from 'path';
import { LanguageId } from './deployment';

export type Runner = 'nodejs' | 'python' | 'ruby' | 'csharp';

export interface RunnerInfo {
	id: Runner;
	languageId: LanguageId;
	filePatterns: RegExp[];
	installCommand: string;
	displayName: string;
}

export const Runners: Record<Runner, RunnerInfo> = {
	nodejs: {
		id: 'nodejs',
		languageId: 'node',
		filePatterns: [/^package\.json$/],
		installCommand: 'npm install',
		displayName: 'NPM'
	},
	python: {
		id: 'python',
		languageId: 'py',
		filePatterns: [/^requirements\.txt$/],
		installCommand: 'pip install -r requirements.txt',
		displayName: 'Pip'
	},
	ruby: {
		id: 'ruby',
		languageId: 'rb',
		filePatterns: [/^Gemfile$/],
		installCommand: 'bundle install',
		displayName: 'Gem'
	},
	csharp: {
		id: 'csharp',
		languageId: 'cs',
		filePatterns: [/^project\.json$/, /\.csproj$/],
		installCommand: 'dotnet restore',
		displayName: 'NuGet'
	}
};

interface Language {
	tag: string; // Tag which corresponds to language_id in metacall.json
	displayName: string; // Name for displaying the language
	hexColor: string; // Color for displaying the language related things
	fileExtRegex: RegExp; // Regex for selecting the metacall.json scripts field
	runnerName?: Runner; // Id of the runner
	runnerFilesRegexes: RegExp[]; // Regex for generating the runners list
}

export const Languages: Record<LanguageId, Language> = {
	cs: {
		tag: 'cs',
		displayName: 'C#',
		hexColor: '#953dac',
		fileExtRegex: /^cs$/,
		runnerName: 'csharp',
		runnerFilesRegexes: Runners.csharp.filePatterns
	},
	py: {
		tag: 'py',
		displayName: 'Python',
		hexColor: '#ffd43b',
		fileExtRegex: /^py$/,
		runnerName: 'python',
		runnerFilesRegexes: Runners.python.filePatterns
	},
	rb: {
		tag: 'rb',
		displayName: 'Ruby',
		hexColor: '#e53935',
		fileExtRegex: /^rb$/,
		runnerName: 'ruby',
		runnerFilesRegexes: Runners.ruby.filePatterns
	},
	node: {
		tag: 'node',
		displayName: 'NodeJS',
		hexColor: '#3c873a',
		fileExtRegex: /^js$/,
		runnerName: 'nodejs',
		runnerFilesRegexes: Runners.nodejs.filePatterns
	},
	ts: {
		tag: 'ts',
		displayName: 'TypeScript',
		hexColor: '#007acc',
		fileExtRegex: /^(ts|tsx)$/,
		runnerName: 'nodejs',
		runnerFilesRegexes: Runners.nodejs.filePatterns
	},
	file: {
		tag: 'file',
		displayName: 'Static Files',
		hexColor: '#de5500',
		fileExtRegex: /^\w+$/,
		runnerName: undefined, // File has no runner (yet?)
		runnerFilesRegexes: [] // File has no runner files (yet?)
	},
	cob: {
		tag: 'cob',
		displayName: 'Cobol',
		hexColor: '#01325a',
		fileExtRegex: /^(cob|cbl|cbl)$/,
		runnerName: undefined, // Cobol has no runner (yet?)
		runnerFilesRegexes: [] // Cobol has no runner files (yet?)
	},
	rpc: {
		tag: 'rpc',
		displayName: 'RPC',
		hexColor: '#0f564d',
		fileExtRegex: /^rpc$/,
		runnerName: undefined, // RPC has no runner (yet?)
		runnerFilesRegexes: [] // RPC has no runner files (yet?)
	}
};

export const DisplayNameToLanguageId: Record<string, LanguageId> = Object.keys(
	Languages
).reduce(
	(obj, lang) =>
		Object.assign(obj, {
			[Languages[lang as LanguageId].displayName]: lang
		}),
	{}
);

export const RunnerToDisplayName = (runner: string): string => {
	const match = Runners[runner as Runner];

	return match ? match.displayName : 'Build';
};

export const detectRunnersFromFiles = (files: string[]): Runner[] => {
	const runners = new Set<Runner>();

	for (const file of files) {
		const fileName = basename(file);

		for (const runner of Object.values(Runners)) {
			for (const pattern of runner.filePatterns) {
				if (pattern.exec(fileName)) {
					runners.add(runner.id);
					break;
				}
			}
		}
	}

	return Array.from(runners);
};

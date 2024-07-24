/*

* About File:
	it defines the structure of the deployments (when we do inspect for example), it also defines the structure of metacall.json

*/

export type DeployStatus = 'create' | 'ready' | 'fail';

export enum LogType {
	Job = 'job',
	Deploy = 'deploy'
}

export type LanguageId =
	| 'node'
	| 'ts'
	| 'rb'
	| 'py'
	| 'cs'
	// | 'wasm'
	// | 'java'
	// | 'c'
	| 'cob'
	| 'file'
	| 'rpc';

export enum ValueId {
	METACALL_BOOL = 0,
	METACALL_CHAR = 1,
	METACALL_SHORT = 2,
	METACALL_INT = 3,
	METACALL_LONG = 4,
	METACALL_FLOAT = 5,
	METACALL_DOUBLE = 6,
	METACALL_STRING = 7,
	METACALL_BUFFER = 8,
	METACALL_ARRAY = 9,
	METACALL_MAP = 10,
	METACALL_PTR = 11,
	METACALL_FUTURE = 12,
	METACALL_FUNCTION = 13,
	METACALL_NULL = 14,
	METACALL_CLASS = 15,
	METACALL_OBJECT = 16,

	METACALL_SIZE,
	METACALL_INVALID
}

interface Type {
	name: string;
	id: ValueId;
}

interface Return {
	type: Type;
}

interface Argument {
	name: string;
	type: Type;
}

interface Signature {
	ret: Return;
	args: Argument[];
}

interface Func {
	name: string;
	signature: Signature;
	async: boolean;
}

// TODO
/*
interface Class {

}

interface Object {

}
*/

interface Scope {
	name: string;
	funcs: Func[];
	classes: string[]; // TODO: Class[];
	objects: string[]; // TODO: Object[];
}

interface Handle {
	name: string;
	scope: Scope;
}

export interface Deployment {
	status: DeployStatus;
	prefix: string;
	suffix: string;
	version: string;
	packages: Record<LanguageId, Handle[]>;
	ports: number[];
}
export class IDeployment implements Deployment {
	public status: DeployStatus;
	public prefix: string;
	public suffix: string;
	public version: string;
	public packages: Record<LanguageId, Handle[]>;
	public ports: number[];

	constructor(
		status: DeployStatus,
		prefix: string,
		suffix: string,
		version: string,
		packages: Record<LanguageId, Handle[]>,
		ports: number[]
	) {
		this.status = status;
		this.prefix = prefix;
		this.suffix = suffix;
		this.version = version;
		this.packages = packages;
		this.ports = ports;
	}
}

export interface Create {
	suffix: string;
	prefix: string;
	version: string;
}

export type MetaCallJSON = {
	language_id: LanguageId;
	path: string;
	scripts: string[];
};

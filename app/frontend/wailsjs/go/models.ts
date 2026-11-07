export namespace git {
	
	export class Branch {
	    name: string;
	    remote: string;
	    isHead: boolean;
	    upstream: string;
	    ahead: number;
	    behind: number;
	
	    static createFrom(source: any = {}) {
	        return new Branch(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.remote = source["remote"];
	        this.isHead = source["isHead"];
	        this.upstream = source["upstream"];
	        this.ahead = source["ahead"];
	        this.behind = source["behind"];
	    }
	}
	export class BranchList {
	    local: Branch[];
	    remotes: Branch[];
	
	    static createFrom(source: any = {}) {
	        return new BranchList(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.local = this.convertValues(source["local"], Branch);
	        this.remotes = this.convertValues(source["remotes"], Branch);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class CherryPickState {
	    conflictCount: number;
	    pickedMessage: string;
	
	    static createFrom(source: any = {}) {
	        return new CherryPickState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.conflictCount = source["conflictCount"];
	        this.pickedMessage = source["pickedMessage"];
	    }
	}
	export class GraphLine {
	    fromCol: number;
	    toCol: number;
	    color: number;
	    isMerge: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GraphLine(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.fromCol = source["fromCol"];
	        this.toCol = source["toCol"];
	        this.color = source["color"];
	        this.isMerge = source["isMerge"];
	    }
	}
	export class Ref {
	    name: string;
	    type: string;
	    isHead: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Ref(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.isHead = source["isHead"];
	    }
	}
	export class CommitNode {
	    hash: string;
	    shortHash: string;
	    message: string;
	    fullMessage: string;
	    author: string;
	    email: string;
	    // Go type: time
	    date: any;
	    parents: string[];
	    refs: Ref[];
	    column: number;
	    color: number;
	    lines: GraphLine[];
	
	    static createFrom(source: any = {}) {
	        return new CommitNode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hash = source["hash"];
	        this.shortHash = source["shortHash"];
	        this.message = source["message"];
	        this.fullMessage = source["fullMessage"];
	        this.author = source["author"];
	        this.email = source["email"];
	        this.date = this.convertValues(source["date"], null);
	        this.parents = source["parents"];
	        this.refs = this.convertValues(source["refs"], Ref);
	        this.column = source["column"];
	        this.color = source["color"];
	        this.lines = this.convertValues(source["lines"], GraphLine);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DiffLine {
	    type: string;
	    content: string;
	    oldNo: number;
	    newNo: number;
	
	    static createFrom(source: any = {}) {
	        return new DiffLine(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.content = source["content"];
	        this.oldNo = source["oldNo"];
	        this.newNo = source["newNo"];
	    }
	}
	export class DiffHunk {
	    header: string;
	    oldStart: number;
	    oldLines: number;
	    newStart: number;
	    newLines: number;
	    lines: DiffLine[];
	
	    static createFrom(source: any = {}) {
	        return new DiffHunk(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.header = source["header"];
	        this.oldStart = source["oldStart"];
	        this.oldLines = source["oldLines"];
	        this.newStart = source["newStart"];
	        this.newLines = source["newLines"];
	        this.lines = this.convertValues(source["lines"], DiffLine);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class DiffFile {
	    path: string;
	    oldPath: string;
	    hunks: DiffHunk[];
	    binary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DiffFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.oldPath = source["oldPath"];
	        this.hunks = this.convertValues(source["hunks"], DiffHunk);
	        this.binary = source["binary"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class FileStatus {
	    path: string;
	    oldPath: string;
	    staged: string;
	    unstaged: string;
	    added: number;
	    deleted: number;
	
	    static createFrom(source: any = {}) {
	        return new FileStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.oldPath = source["oldPath"];
	        this.staged = source["staged"];
	        this.unstaged = source["unstaged"];
	        this.added = source["added"];
	        this.deleted = source["deleted"];
	    }
	}
	
	export class MergeState {
	    mergingBranch: string;
	    conflictCount: number;
	    mergeMessage: string;
	
	    static createFrom(source: any = {}) {
	        return new MergeState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.mergingBranch = source["mergingBranch"];
	        this.conflictCount = source["conflictCount"];
	        this.mergeMessage = source["mergeMessage"];
	    }
	}
	export class PullSnapshot {
	    repo: string;
	    branch: string;
	    head: string;
	    upstream: string;
	    target: string;
	    remote: string;
	    mergeRef: string;
	
	    static createFrom(source: any = {}) {
	        return new PullSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.repo = source["repo"];
	        this.branch = source["branch"];
	        this.head = source["head"];
	        this.upstream = source["upstream"];
	        this.target = source["target"];
	        this.remote = source["remote"];
	        this.mergeRef = source["mergeRef"];
	    }
	}
	export class PullResult {
	    outcome: string;
	    snapshot?: PullSnapshot;
	    detail?: string;
	
	    static createFrom(source: any = {}) {
	        return new PullResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.outcome = source["outcome"];
	        this.snapshot = this.convertValues(source["snapshot"], PullSnapshot);
	        this.detail = source["detail"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class RebaseAction {
	    action: string;
	    hash: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new RebaseAction(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.action = source["action"];
	        this.hash = source["hash"];
	        this.message = source["message"];
	    }
	}
	export class RebaseState {
	    inProgress: boolean;
	    headName: string;
	    onto: string;
	    step: number;
	    total: number;
	    conflictCount: number;
	
	    static createFrom(source: any = {}) {
	        return new RebaseState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.inProgress = source["inProgress"];
	        this.headName = source["headName"];
	        this.onto = source["onto"];
	        this.step = source["step"];
	        this.total = source["total"];
	        this.conflictCount = source["conflictCount"];
	    }
	}
	
	export class Remote {
	    name: string;
	    fetchURL: string;
	    pushURL: string;
	
	    static createFrom(source: any = {}) {
	        return new Remote(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.fetchURL = source["fetchURL"];
	        this.pushURL = source["pushURL"];
	    }
	}
	export class RepoStatus {
	    branch: string;
	    ahead: number;
	    behind: number;
	    files: FileStatus[];
	    hasConflicts: boolean;
	    mergeState?: MergeState;
	    cherryPickState?: CherryPickState;
	    rebaseState?: RebaseState;
	
	    static createFrom(source: any = {}) {
	        return new RepoStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.branch = source["branch"];
	        this.ahead = source["ahead"];
	        this.behind = source["behind"];
	        this.files = this.convertValues(source["files"], FileStatus);
	        this.hasConflicts = source["hasConflicts"];
	        this.mergeState = this.convertValues(source["mergeState"], MergeState);
	        this.cherryPickState = this.convertValues(source["cherryPickState"], CherryPickState);
	        this.rebaseState = this.convertValues(source["rebaseState"], RebaseState);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class StashEntry {
	    index: number;
	    message: string;
	    hash: string;
	    // Go type: time
	    date: any;
	
	    static createFrom(source: any = {}) {
	        return new StashEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.message = source["message"];
	        this.hash = source["hash"];
	        this.date = this.convertValues(source["date"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Tag {
	    name: string;
	    hash: string;
	    // Go type: time
	    date: any;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new Tag(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.hash = source["hash"];
	        this.date = this.convertValues(source["date"], null);
	        this.message = source["message"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WorktreeInfo {
	    path: string;
	    branch: string;
	    head: string;
	    isMain: boolean;
	    isDirty: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WorktreeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.branch = source["branch"];
	        this.head = source["head"];
	        this.isMain = source["isMain"];
	        this.isDirty = source["isDirty"];
	    }
	}

}


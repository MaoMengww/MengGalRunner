export namespace model {
	
	export class Game {
	    id: string;
	    title: string;
	    original_title: string;
	    dir_path: string;
	    exe_path: string;
	    cover_path: string;
	    play_time_sec: number;
	    last_played: string;
	    vndb_id: string;
	    is_deleted: boolean;
	    developer: string;
	    summary: string;
	
	    static createFrom(source: any = {}) {
	        return new Game(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.original_title = source["original_title"];
	        this.dir_path = source["dir_path"];
	        this.exe_path = source["exe_path"];
	        this.cover_path = source["cover_path"];
	        this.play_time_sec = source["play_time_sec"];
	        this.last_played = source["last_played"];
	        this.vndb_id = source["vndb_id"];
	        this.is_deleted = source["is_deleted"];
	        this.developer = source["developer"];
	        this.summary = source["summary"];
	    }
	}
	export class AppState {
	    libraries: string[];
	    games: Game[];
	
	    static createFrom(source: any = {}) {
	        return new AppState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.libraries = source["libraries"];
	        this.games = this.convertValues(source["games"], Game);
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
	
	export class GameMetadataUpdate {
	    title: string;
	    original_title: string;
	    exe_path: string;
	    cover_path: string;
	    vndb_id: string;
	    developer: string;
	    summary: string;
	
	    static createFrom(source: any = {}) {
	        return new GameMetadataUpdate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.original_title = source["original_title"];
	        this.exe_path = source["exe_path"];
	        this.cover_path = source["cover_path"];
	        this.vndb_id = source["vndb_id"];
	        this.developer = source["developer"];
	        this.summary = source["summary"];
	    }
	}

}


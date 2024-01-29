import { DeleteResult } from "typeorm";
import { Alert } from "./database/models/Alert";
import { LiveFeed } from "./database/models/LiveFeed";

export interface Api {
	startCamera: (url: string) => void;
	startWebcam: (cam: number) => void;
	requestDetections: () => Promise<string>;
	getAlerts: () => Promise<Alert[]>;
	deleteAlert: (id: string) => Promise<DeleteResult>;
	getLiveFeeds: () => Promise<LiveFeed[]>;
}

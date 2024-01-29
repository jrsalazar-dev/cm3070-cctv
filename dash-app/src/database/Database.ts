import {
	createConnection,
	Connection,
	DeleteResult,
	Repository,
} from "typeorm";
import { Alert } from "./models/Alert";
import { LiveFeed } from "./models/LiveFeed";

export default class Database {
	private connection: Connection | null = null;

	public async init(): Promise<Database> {
		this.connection = await createConnection({
			type: "sqlite",
			synchronize: true,
			logging: true,
			logger: "simple-console",
			database: "camdb.db",
			entities: [Alert, LiveFeed],
		});

		if (this.connection.isConnected) {
			this.connection.synchronize();
		}

		return this;
	}

	private getAlertRepository(): Repository<Alert> {
		if (!this.connection) {
			throw new Error("No database connection");
		}
		return this.connection.getRepository(Alert);
	}

	private getLiveFeedRepository(): Repository<LiveFeed> {
		if (!this.connection) {
			throw new Error("No database connection");
		}
		return this.connection.getRepository(LiveFeed);
	}

	public async insert(alert: Alert): Promise<Alert> {
		const alertRepository = this.getAlertRepository();

		return alertRepository.save(alert);
	}

	public async deleteAlert(id: string): Promise<DeleteResult> {
		const alertRepository = this.getAlertRepository();

		return alertRepository.delete(id);
	}

	public async fetchAlerts(): Promise<Alert[]> {
		const alertRepository = this.getAlertRepository();

		return alertRepository.find({
			relations: ["detection_feed"],
		});
	}

	public async fetchLiveFeeds(): Promise<LiveFeed[]> {
		const liveFeedRepository = this.getLiveFeedRepository();

		return liveFeedRepository.find();
	}
}

import * as dotenv from "dotenv";
import { existsSync } from "fs";

/**
 * Load environment variables from .env file
 */
export class ConfigLoader {
  private static instance: ConfigLoader;
  private readonly envConfig: { [key: string]: string | undefined };

  nodeEnv: string;

  private constructor() {
    this.nodeEnv = process.env.NODE_ENV || "development";
    const envFilePath = `.env.${this.nodeEnv}`;

    if (!existsSync(envFilePath)) {
      throw new Error(`Environment file not found: ${envFilePath}`);
    }

    const result = dotenv.config({ path: envFilePath });
    if (result.error) {
      throw result.error;
    }

    this.envConfig = result.parsed ?? {};
  }

  /**
   * Get the singleton instance of the ConfigLoader class.
   * If the instance doesn't exist or forceReload is true, a new instance will be created.
   * @param forceReload Force reload the config file
   * @returns The singleton instance of the ConfigLoader class.
   */
  public static getInstance(forceReload: boolean = false): ConfigLoader {
    if (!ConfigLoader.instance || forceReload) {
      ConfigLoader.instance = new ConfigLoader();
    }

    return ConfigLoader.instance;
  }

  /**
   * Get the value of an environment variable
   * @param key Environment variable key
   * @returns The value of the environment variable
   */
  public get(key: string): string {
    const value = this.envConfig[key];
    if (!value) {
      throw new Error(`Environment variable ${key} not found`);
    }

    return value;
  }
}

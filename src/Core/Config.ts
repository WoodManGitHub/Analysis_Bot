export interface RankConfig {
    description: string
}

export interface BotEmbed {
    color: number
    errorColor: number
    rank: RankConfig
}

export interface BotConfig {
    token: string
    prefix: string
    admin: string[]
    embed: BotEmbed
    messageCooldownSecond: number
}

export interface DBConfig {
    host: string
    name: string
}

export interface RedisConfig {
    host: string
    port: number
}

export interface RecaptchaConfig {
    secretKey: string
}

export interface WebConfig {
    host: string
    port: number
    devPort: number
    devMode: boolean
    origin: string
    recaptcha: RecaptchaConfig
    cacheDayTTL: number
}

export interface Config {
    bot: BotConfig
    database: DBConfig
    cache: RedisConfig
    web: WebConfig
}
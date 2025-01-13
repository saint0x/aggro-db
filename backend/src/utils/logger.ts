import chalk from 'chalk'

class Logger {
  private timestamp(): string {
    return new Date().toISOString()
  }

  debug(message: string, ...args: any[]): void {
    console.log(chalk.gray(`[${this.timestamp()}] DEBUG: ${message}`), ...args)
  }

  info(message: string, ...args: any[]): void {
    console.log(chalk.blue(`[${this.timestamp()}] INFO: ${message}`), ...args)
  }

  success(message: string, ...args: any[]): void {
    console.log(chalk.green(`[${this.timestamp()}] SUCCESS: ${message}`), ...args)
  }

  warn(message: string, ...args: any[]): void {
    console.log(chalk.yellow(`[${this.timestamp()}] WARN: ${message}`), ...args)
  }

  error(message: string, ...args: any[]): void {
    console.error(chalk.red(`[${this.timestamp()}] ERROR: ${message}`), ...args)
  }

  startupComplete(port: number): void {
    console.log('\n' + chalk.green('🚀 Server started successfully!'));
    console.log(chalk.cyan(`🌐 Server running at http://localhost:${port}`));
    console.log(chalk.gray(`📝 Environment: ${process.env.NODE_ENV || 'development'}\n`));
  }
}

export const logger = new Logger() 
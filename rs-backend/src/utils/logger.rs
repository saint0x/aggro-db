use tracing_subscriber::{fmt, EnvFilter};
use tracing::info;

pub fn init_logger() {
    // Initialize the logger with a default configuration
    let _subscriber = fmt()
        .with_env_filter(EnvFilter::from_default_env()
            .add_directive("info".parse().unwrap())
            .add_directive("rs_backend=debug".parse().unwrap()))
        .with_target(true)
        .with_thread_ids(true)
        .with_line_number(true)
        .with_file(true)
        .with_level(true)
        .with_ansi(true)
        .init();

    info!("Logger initialized");
}

pub fn startup_complete(port: u16) {
    info!("Server started successfully on port {}", port);
    info!("Health check available at http://localhost:{}/health", port);
} 
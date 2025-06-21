import amqp, { ChannelModel, ConsumeMessage, Channel } from 'amqplib';
import prom from 'prom-client';

// RabbitMQ connection settings (must match the producer)
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_NAME = process.env.EXCHANGE_NAME || 'sensor_data';
const EXCHANGE_TYPE = process.env.EXCHANGE_TYPE || 'topic';
const BINDING_KEY = process.env.BINDING_KEY || 'sensor.temperature_humidity';
const PUSHGATEWAY_URL = process.env.PUSHGATEWAY_URL || 'http://localhost:9091';
const JOB_NAME = process.env.JOB_NAME || 'temperature-and-humidity-simulator';

// --- Prometheus Metrics Setup ---
const register = new prom.Registry();
const gateway = new prom.Pushgateway(PUSHGATEWAY_URL, {}, register);

const messagesReceivedCounter = new prom.Counter({
    name: 'consumer_messages_received_total',
    help: 'Total number of messages received from RabbitMQ',
    labelNames: ['sensorId'],
});
register.registerMetric(messagesReceivedCounter);

const messagesProcessedCounter = new prom.Counter({
    name: 'consumer_messages_processed_total',
    help: 'Total number of messages successfully processed',
    labelNames: ['sensorId'],
});
register.registerMetric(messagesProcessedCounter);

const messagesFailedCounter = new prom.Counter({
    name: 'consumer_messages_failed_total',
    help: 'Total number of messages that failed to be processed',
    labelNames: ['sensorId'],
});
register.registerMetric(messagesFailedCounter);

const lastTemperatureGauge = new prom.Gauge({
    name: 'consumer_last_temperature_celsius',
    help: 'The last temperature value received',
    labelNames: ['sensorId'],
});
register.registerMetric(lastTemperatureGauge);

const lastHumidityGauge = new prom.Gauge({
    name: 'consumer_last_humidity_percent',
    help: 'The last humidity value received',
    labelNames: ['sensorId'],
});
register.registerMetric(lastHumidityGauge);

/**
 * Pushes all registered metrics to the Pushgateway.
 */
async function pushMetrics(groupings?: { [key: string]: string }) {
    try {
        await gateway.push({ jobName: JOB_NAME, groupings });
    } catch (error) {
        const groupInfo = groupings ? ` for group ${JSON.stringify(groupings)}` : '';
        console.error(`Error pushing metrics to Pushgateway${groupInfo}:`, error);
    }
}

/**
 * Processes a single message from the queue.
 * @param msg The message from RabbitMQ.
 * @param channel The channel the message was received on.
 */
export async function handleMessage(msg: ConsumeMessage | null, channel: Channel) {
    if (!msg) {
        return;
    }

    let sensorId: string = 'unknown';
    const content = msg.content.toString();
    try {
        try {
            const content = msg.content.toString();
            const data = JSON.parse(content);

            // Attempt to get a valid sensorId for labeling.
            if (data && typeof data.sensorId === 'string' && data.sensorId.length > 0) {
                sensorId = data.sensorId;
            }

             messagesReceivedCounter.labels(sensorId).inc();

            // Full validation for processing.
            if (sensorId === 'unknown' || typeof data.temperature !== 'number' || typeof data.humidity !== 'number') {
                throw new Error(`Invalid data format or missing sensorId.`);
            }

            console.log(`[x] Received from sensor '${sensorId}' on binding key '${msg.fields.routingKey}':`);
            console.log(JSON.stringify(data, null, 2));

            // Update Prometheus metrics with labels.
            lastTemperatureGauge.labels(sensorId).set(data.temperature);
            lastHumidityGauge.labels(sensorId).set(data.humidity);
            messagesProcessedCounter.labels(sensorId).inc();

            // Acknowledge the message to confirm it has been processed.
            channel.ack(msg);
        } catch (e) {
            // This single catch block handles both JSON parsing and validation errors.
            console.error(`Failed to process message. Sensor ID: '${sensorId}'. Error:`, e instanceof Error ? e.message : e);
            messagesFailedCounter.labels(sensorId).inc();

            // Reject the message if it's malformed and don't requeue it.
            channel.nack(msg, false, false);
        } finally {
            // Always push metrics, grouped by the determined sensorId.
            await pushMetrics({ sensorId });
        }
    } catch (error) {
        // This outer catch is a safeguard against unexpected errors in the handler logic itself.
        console.error("A critical error occurred in the message handler:", error);
        // We still try to push metrics, as the counters might have been incremented.
        await pushMetrics({ sensorId });
    }
}

/**
 * Main function to start the consumer.
 * It connects to RabbitMQ and starts listening for sensor data.
 */
async function main() {
    let connection: ChannelModel | null = null;
    try {
        console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
        connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        console.log(`Asserting exchange "${EXCHANGE_NAME}"...`);
        await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: false });

        // Assert a temporary, exclusive queue. RabbitMQ will generate a name for it.
        const q = await channel.assertQueue('', { exclusive: true });
        console.log(`[*] Waiting for messages in queue: ${q.queue}. To exit press CTRL+C`);

        // Bind the queue to the exchange with the specified binding key.
        // This tells the exchange to send messages matching the key to our queue.
        await channel.bindQueue(q.queue, EXCHANGE_NAME, BINDING_KEY);

        // Start consuming messages from the queue.
        channel.consume(q.queue, (msg: ConsumeMessage | null) => {
            // handleMessage is async, but we don't need to await it here.
            // It will run, update metrics, and ack/nack the message independently.
            // Errors are handled inside handleMessage.
            handleMessage(msg, channel);
        });

        // Handle graceful shutdown.
        process.on('SIGINT', async () => {
            console.log('\nCaught interrupt signal. Shutting down.');

            // A final push of metrics can be useful for some observability patterns.
            await pushMetrics().catch(err => console.error("Final metrics push failed on shutdown:", err));

            // Close the channel and connection.
            if (connection) {
                await connection.close();
            }
            process.exit(0);
        });

    } catch (error) {
        console.error('Error starting consumer:', error);
        process.exit(1);
    }
}

// This ensures the main function is called only when the script is executed directly
if (require.main === module) {
    main();
}

import amqp, { ChannelModel, ConsumeMessage, Channel } from 'amqplib';

// RabbitMQ connection settings (must match the producer)
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_NAME = process.env.EXCHANGE_NAME || 'sensor_data';
const EXCHANGE_TYPE = process.env.EXCHANGE_TYPE || 'topic';
const BINDING_KEY = process.env.BINDING_KEY || 'sensor.temperature_humidity';

/**
 * Processes a single message from the queue.
 * @param msg The message from RabbitMQ.
 * @param channel The channel the message was received on.
 */
export function handleMessage(msg: ConsumeMessage | null, channel: Channel) {
    if (msg) {
        try {
            const content = msg.content.toString();
            const data = JSON.parse(content);
            console.log(`[x] Received on binding key '${msg.fields.routingKey}':`);
            console.log(JSON.stringify(data, null, 2));

            // Acknowledge the message to confirm it has been processed.
            channel.ack(msg);
        } catch (e) {
            console.error("Failed to process message:", e);
            // Reject the message if it's malformed and don't requeue it.
            channel.nack(msg, false, false);
        }
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
            handleMessage(msg, channel);
        });

        // Handle graceful shutdown.
        process.on('SIGINT', async () => {
            console.log('\nCaught interrupt signal. Shutting down.');
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

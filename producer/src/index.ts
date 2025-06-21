import amqp from 'amqplib';

// RabbitMQ connection settings
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const EXCHANGE_NAME = process.env.EXCHANGE_NAME || 'sensor_data';
const EXCHANGE_TYPE = process.env.EXCHANGE_TYPE || 'topic';
const ROUTING_KEY = process.env.ROUTING_KEY || 'sensor.temperature_humidity';
const SENSOR_ID = process.env.SENSOR_ID || 'dht22-01';

/**
 * Generates a random number within a specified range.
 * @param min The minimum value.
 * @param max The maximum value.
 * @param decimalPlaces The number of decimal places for the result.
 * @returns A random number.
 */
function getRandomValue(min: number, max: number, decimalPlaces: number = 2): number {
    const rand = Math.random() * (max - min) + min;
    const power = Math.pow(10, decimalPlaces);
    return Math.floor(rand * power) / power;
}

/**
 * Generates a simulated sensor data payload.
 * @returns An object with temperature, humidity, and a timestamp.
 */
export function generateSensorData() {
    // Simulate realistic temperature in Celsius
    const temperature = getRandomValue(18, 28);
    // Simulate realistic relative humidity in percentage
    const humidity = getRandomValue(40, 60);

    return {
        temperature,
        humidity,
        timestamp: new Date().toISOString(),
        sensorId: SENSOR_ID,
    };
}

/**
 * Main function to start the simulator.
 * It connects to RabbitMQ and starts publishing sensor data periodically.
 */
async function main() {
    try {
        console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();

        console.log(`Asserting exchange "${EXCHANGE_NAME}"...`);
        await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: false });

        console.log('Simulator started. Publishing data every 5 seconds. Press CTRL+C to stop.');
        // Publish data every 5 seconds
        const intervalId = setInterval(() => {
            const data = generateSensorData();
            const message = JSON.stringify(data);

            // Publish to the exchange with a routing key
            channel.publish(EXCHANGE_NAME, ROUTING_KEY, Buffer.from(message));
            console.log(`[x] Sent to '${EXCHANGE_NAME}': ${message}`);
        }, 1000);

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\nCaught interrupt signal. Shutting down.');
            clearInterval(intervalId);
            // Give it a moment to close connection
            setTimeout(() => {
                connection.close();
                process.exit(0);
            }, 500);
        });

    } catch (error) {
        console.error('Error starting simulator:', error);
        process.exit(1);
    }
}

// This ensures the main function is called only when the script is executed directly
if (require.main === module) {
    main();
}

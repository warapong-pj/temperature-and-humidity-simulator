import amqp from 'amqplib';

const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost';
const rabbitmqUsername = process.env.RABBITMQ_USERNAME || 'admin';
const rabbitmqPassword = process.env.RABBITMQ_PASSWORD || 'admin';
const rabbitmqQueue = process.env.RABBITMQ_QUEUE || 'sensor_data';

export async function consumeMessages() {
  try {
    const connection = await amqp.connect({
      hostname: rabbitmqHost,
      port: 5672,
      username: rabbitmqUsername,
      password: rabbitmqPassword,
    });
    const channel = await connection.createChannel();

    await channel.assertQueue(rabbitmqQueue, { durable: false });

    console.log(` [*] Waiting for messages in ${rabbitmqQueue}. To exit press CTRL+C`);

    channel.consume(
      rabbitmqQueue,
      (msg) => {
        if (msg) {
          console.log(` [x] Received ${msg.content.toString()}`);
        }
      },
      { noAck: true }
    );
  } catch (error) {
    console.error('Error connecting to RabbitMQ:', error);
  }
}

consumeMessages().catch(console.error);

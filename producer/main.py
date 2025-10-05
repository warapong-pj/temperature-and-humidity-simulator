import pika
import json
import time
import os
import random
from datetime import datetime

# RabbitMQ connection parameters
rabbitmq_host = os.environ.get('RABBITMQ_HOST', 'localhost')  # Change this to your RabbitMQ server address if needed
rabbitmq_username = os.environ.get('RABBITMQ_USERNAME', 'admin')
rabbitmq_password = os.environ.get('RABBITMQ_PASSWORD', 'admin')
rabbitmq_queue = os.environ.get('RABBITMQ_QUEUE', 'sensor_data')

# Function to generate random temperature and humidity data
def generate_sensor_data():
    temperature = round(random.uniform(20, 30), 2)  # Temperature between 20°C and 30°C
    humidity = round(random.uniform(40, 60), 2)  # Humidity between 40% and 60%
    timestamp = datetime.now().isoformat()
    return {
        'temperature': temperature,
        'humidity': humidity,
        'timestamp': timestamp
    }

# Function to send data to RabbitMQ
def send_to_rabbitmq(data):
    try:
        credentials = pika.PlainCredentials(rabbitmq_username, rabbitmq_password)
        parameters = pika.ConnectionParameters(host=rabbitmq_host,
                                                 port=5672,
                                                 credentials=credentials)

        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()

        channel.queue_declare(queue=rabbitmq_queue)

        channel.basic_publish(exchange='',
                              routing_key=rabbitmq_queue,
                              body=json.dumps(data))
        print(f" [x] Sent {data}")
        connection.close()

    except pika.exceptions.AMQPConnectionError as e:
        print(f"Error connecting to RabbitMQ: {e}")

# Main loop to simulate and send data every 1 second
def main():
    while True:
        sensor_data = generate_sensor_data()
        send_to_rabbitmq(sensor_data)
        time.sleep(1)  # Wait for 1 second

if __name__ == "__main__":
    main()

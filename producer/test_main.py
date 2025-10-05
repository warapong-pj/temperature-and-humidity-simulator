import unittest
from unittest.mock import patch
import pika
import json
import datetime
from main import generate_sensor_data, send_to_rabbitmq

class TestSensorDataFunctions(unittest.TestCase):

    def test_generate_sensor_data(self):
        data = generate_sensor_data()
        self.assertIsInstance(data, dict)
        self.assertIn('temperature', data)
        self.assertIn('humidity', data)
        self.assertIn('timestamp', data)
        self.assertIsInstance(data['temperature'], float)
        self.assertIsInstance(data['humidity'], float)
        self.assertIsInstance(data['timestamp'], str)
        #test temperature and humidity ranges
        self.assertTrue(20 <= data['temperature'] <= 30)
        self.assertTrue(40 <= data['humidity'] <= 60)

    @patch('pika.BlockingConnection')
    def test_send_to_rabbitmq(self, mock_connection):
        mock_channel = mock_connection.return_value.channel.return_value
        test_data = {'temperature': 25.0, 'humidity': 50.0, 'timestamp': datetime.datetime.now().isoformat()}

        send_to_rabbitmq(test_data)

        mock_connection.assert_called_once()
        mock_channel.queue_declare.assert_called_once_with(queue='sensor_data')
        mock_channel.basic_publish.assert_called_once_with(
            exchange='',
            routing_key='sensor_data',
            body=json.dumps(test_data)
        )
        mock_connection.return_value.close.assert_called_once()

if __name__ == '__main__':
    unittest.main()

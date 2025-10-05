import amqp from 'amqplib';
import { consumeMessages } from './main';

jest.mock('amqplib');

const mockedAmqp = amqp as jest.Mocked<typeof amqp>;

describe('consumeMessages', () => {
  const mockConnect = jest.fn();
  const mockCreateChannel = jest.fn();
  const mockAssertQueue = jest.fn();
  const mockConsume = jest.fn();
  const mockChannel = {
    assertQueue: mockAssertQueue,
    consume: mockConsume,
  };
  const mockConnection = {
    createChannel: mockCreateChannel.mockResolvedValue(mockChannel),
    close: jest.fn(),
  };

  beforeEach(() => {
    mockConnect.mockResolvedValue(mockConnection);
    mockedAmqp.connect.mockImplementation(mockConnect)
    mockCreateChannel.mockResolvedValue(mockChannel);
    mockAssertQueue.mockResolvedValue(undefined);
    mockConsume.mockImplementation((queue, callback) => {
      // Simulate message consumption
      const message = {
        content: Buffer.from('{"temperature": 25, "humidity": 60}')
      };
      callback(message as amqp.ConsumeMessage | null);
      return { consumerTag: 'testTag' };
    });

  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should connect to RabbitMQ, assert the queue, and consume messages', async () => {
    await consumeMessages();

    expect(mockConnect).toHaveBeenCalledWith({
      hostname: 'localhost',
      port: 5672,
      username: 'admin',
      password: 'admin',
    });
    expect(mockAssertQueue).toHaveBeenCalledWith('sensor_data', { durable: false });
    expect(mockConsume).toHaveBeenCalledTimes(1);
  });
});
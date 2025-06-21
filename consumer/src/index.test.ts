import { Channel, ConsumeMessage } from 'amqplib';
import { handleMessage } from './index';


// Declare mockPush outside so it can be accessed by tests.
var mockPush: jest.Mock;

// Mock the pushMetrics function
jest.mock('prom-client', () => {
    mockPush = jest.fn().mockResolvedValue(undefined); // Initialize mockPush inside the mock factory
    const mockMetricFunctions = {
        inc: jest.fn(),
        set: jest.fn(),
    };

    const mockMetric = {
        ...mockMetricFunctions,
        labels: jest.fn().mockReturnValue(mockMetricFunctions),
    };

    return {
        // We need the real Registry for its `registerMetric` method to exist.
        Registry: jest.requireActual('prom-client').Registry,
        Counter: jest.fn(() => mockMetric),
        Gauge: jest.fn(() => mockMetric),
        Pushgateway: jest.fn(() => ({
            push: mockPush,
        })),
    };
});

describe('Consumer: handleMessage', () => {
    let mockChannel: Partial<Channel>;

    beforeEach(() => {
        // Mock the channel methods we expect to be called
        mockChannel = {
            ack: jest.fn(),
            nack: jest.fn(),
        };
        // Clear all mocks before each test
        jest.clearAllMocks();
    });

    it('should acknowledge a valid message and push metrics with sensorId', async () => {
        const validData = { temperature: 22.5, humidity: 45.5, sensorId: 'dht22-01' };
        const validMessage = {
            content: Buffer.from(JSON.stringify(validData)),
            fields: { routingKey: 'sensor.temperature_humidity' }
        } as ConsumeMessage;

        await handleMessage(validMessage, mockChannel as Channel);

        expect(mockChannel.ack).toHaveBeenCalledWith(validMessage);
        expect(mockChannel.nack).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith({ jobName: expect.any(String), groupings: { sensorId: 'dht22-01' } });
    });

    it('should reject (nack) a message with invalid JSON and push metrics', async () => {
        const invalidMessage = {
            content: Buffer.from('this is not json'),
            fields: { routingKey: 'sensor.temperature_humidity' }
        } as ConsumeMessage;

        await handleMessage(invalidMessage, mockChannel as Channel);

        // Should be called with the message, allUpTo=false, and requeue=false
        expect(mockChannel.nack).toHaveBeenCalledWith(invalidMessage, false, false);
        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('should reject (nack) a message with invalid data structure and push metrics', async () => {
        const invalidData = { temp: 22.5, humid: 45 }; // incorrect keys
        const invalidMessage = {
            content: Buffer.from(JSON.stringify(invalidData)),
            fields: { routingKey: 'sensor.temperature_humidity' }
        } as ConsumeMessage;

        await handleMessage(invalidMessage, mockChannel as Channel);

        expect(mockChannel.nack).toHaveBeenCalledWith(invalidMessage, false, false);
        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith({ jobName: expect.any(String), groupings: { sensorId: 'unknown' } });
    });

    it('should reject (nack) a message with a missing sensorId and push metrics', async () => {
        const invalidData = { temperature: 22.5, humidity: 45 }; // missing sensorId
        const invalidMessage = {
            content: Buffer.from(JSON.stringify(invalidData)),
            fields: { routingKey: 'sensor.temperature_humidity' }
        } as ConsumeMessage;

        await handleMessage(invalidMessage, mockChannel as Channel);

        expect(mockChannel.nack).toHaveBeenCalledWith(invalidMessage, false, false);
        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith({ jobName: expect.any(String), groupings: { sensorId: 'unknown' } });
    });

    it('should do nothing for a null message', async () => {
        await handleMessage(null, mockChannel as Channel);

        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockChannel.nack).not.toHaveBeenCalled();
        expect(mockPush).not.toHaveBeenCalled();
    });
});

import { Channel, ConsumeMessage } from 'amqplib';
import { handleMessage } from './index';

describe('Consumer: handleMessage', () => {
    let mockChannel: Partial<Channel>;

    beforeEach(() => {
        // Mock the channel methods we expect to be called
        mockChannel = {
            ack: jest.fn(),
            nack: jest.fn(),
        };
    });

    it('should acknowledge a valid message', () => {
        const validData = { temperature: 22.5, humidity: 45.5 };
        const validMessage = {
            content: Buffer.from(JSON.stringify(validData)),
            fields: { routingKey: 'sensor.temperature_humidity' }
        } as ConsumeMessage;

        handleMessage(validMessage, mockChannel as Channel);

        expect(mockChannel.ack).toHaveBeenCalledWith(validMessage);
        expect(mockChannel.nack).not.toHaveBeenCalled();
    });

    it('should reject (nack) a message with invalid JSON', () => {
        const invalidMessage = {
            content: Buffer.from('this is not json'),
            fields: { routingKey: 'sensor.temperature_humidity' }
        } as ConsumeMessage;

        handleMessage(invalidMessage, mockChannel as Channel);

        // Should be called with the message, allUpTo=false, and requeue=false
        expect(mockChannel.nack).toHaveBeenCalledWith(invalidMessage, false, false);
        expect(mockChannel.ack).not.toHaveBeenCalled();
    });

    it('should do nothing for a null message', () => {
        handleMessage(null, mockChannel as Channel);

        expect(mockChannel.ack).not.toHaveBeenCalled();
        expect(mockChannel.nack).not.toHaveBeenCalled();
    });
});

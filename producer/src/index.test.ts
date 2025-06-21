import { generateSensorData } from './index';

describe('Producer: generateSensorData', () => {

    it('should return an object with the correct properties', () => {
        const data = generateSensorData();
        expect(data).toHaveProperty('temperature');
        expect(data).toHaveProperty('humidity');
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('sensorId');
    });

    it('should generate temperature within the expected range [18, 28]', () => {
        const data = generateSensorData();
        expect(data.temperature).toBeGreaterThanOrEqual(18);
        expect(data.temperature).toBeLessThanOrEqual(28);
    });

    it('should generate humidity within the expected range [40, 60]', () => {
        const data = generateSensorData();
        expect(data.humidity).toBeGreaterThanOrEqual(40);
        expect(data.humidity).toBeLessThanOrEqual(60);
    });

    it('should include a valid ISO timestamp', () => {
        const data = generateSensorData();
        const parsedDate = new Date(data.timestamp);
        expect(parsedDate.toISOString()).toBe(data.timestamp);
    });
});

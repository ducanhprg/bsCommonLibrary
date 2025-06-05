export const convertMass = (value: number, fromUnit: string, toUnit: string): number => {
    // Convert to kg first
    let inKg = value;
    switch (fromUnit.toLowerCase()) {
        case 'lb':
        case 'lbs':
            inKg = value * 0.45359237;
            break;
        case 'oz':
            inKg = value * 0.028349523125;
            break;
        case 'g':
            inKg = value * 0.001;
            break;
        case 'kg':
            inKg = value;
            break;
        default:
            throw new Error(`Unsupported mass unit: ${fromUnit}`);
    }

    // Convert from kg to target unit
    switch (toUnit.toLowerCase()) {
        case 'lb':
        case 'lbs':
            return inKg / 0.45359237;
        case 'oz':
            return inKg / 0.028349523125;
        case 'g':
            return inKg * 1000;
        case 'kg':
            return inKg;
        default:
            throw new Error(`Unsupported mass unit: ${toUnit}`);
    }
};

export const convertLength = (value: number, fromUnit: string, toUnit: string): number => {
    // Convert to meters first
    let inMeters = value;
    switch (fromUnit.toLowerCase()) {
        case 'in':
            inMeters = value * 0.0254;
            break;
        case 'ft':
            inMeters = value * 0.3048;
            break;
        case 'cm':
            inMeters = value * 0.01;
            break;
        case 'm':
            inMeters = value;
            break;
        default:
            throw new Error(`Unsupported length unit: ${fromUnit}`);
    }

    // Convert from meters to target unit
    switch (toUnit.toLowerCase()) {
        case 'in':
            return inMeters / 0.0254;
        case 'ft':
            return inMeters / 0.3048;
        case 'cm':
            return inMeters * 100;
        case 'm':
            return inMeters;
        default:
            throw new Error(`Unsupported length unit: ${toUnit}`);
    }
};

export const truncateNumber = (value: number, decimals: number): number => {
    const factor = Math.pow(10, decimals);
    return Math.floor(value * factor) / factor;
}; 
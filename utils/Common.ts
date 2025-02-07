import { v4 as uuidv4 } from 'uuid';

export const generateUniqueId = async (): Promise<string> => {
    return uuidv4();
};

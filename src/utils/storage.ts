import type { StorageEnum } from "#/enum";

export const getStringItem = (key: StorageEnum): string | null => {
	return localStorage.getItem(key);
};

export const setStringItem = (key: StorageEnum, value: string): void => {
	localStorage.setItem(key, value);
};

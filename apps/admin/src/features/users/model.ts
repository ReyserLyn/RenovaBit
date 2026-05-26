export interface UserSummary {
	id: string;
	name: string;
	email: string;
	role: string;
	image: string | null;
	emailVerified: boolean;
	username: string | null;
	displayUsername: string | null;
	phone: string | null;
	createdAt: Date;
	updatedAt: Date;
}

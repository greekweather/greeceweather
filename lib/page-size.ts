import { cookies } from "next/headers";
import { PAGE_SIZE_COOKIE } from "@/lib/page-size-shared";

// How many rows each admin list shows per page. Change a number here to change that list's
// default. The "Ανά σελίδα" menu under every list overrides all of them (it is remembered in
// a cookie); the choices it offers are PAGE_SIZE_OPTIONS in lib/page-size-shared.ts.
export const LIST_PAGE_SIZE = {
	posts: 25,
	media: 24,
	outlooks: 25,
	banner: 25,
	tags: 25,
	backup: 25,
	stats: 25,
} as const;

export type PagedList = keyof typeof LIST_PAGE_SIZE;

export { PAGE_SIZE_COOKIE, PAGE_SIZE_OPTIONS } from "@/lib/page-size-shared";

const MIN = 5;
const MAX = 200;

export async function pageSizeFor(list: PagedList): Promise<number> {
	const stored = Number.parseInt((await cookies()).get(PAGE_SIZE_COOKIE)?.value ?? "", 10);

	return Number.isFinite(stored) && stored >= MIN && stored <= MAX ? stored : LIST_PAGE_SIZE[list];
}

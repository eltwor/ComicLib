export type VolumeStub = {
  id: number;
  name: string;
};

export type VolumeDetail = {
  id: number;
  name: string;
  aliases: string[];
  numberOfIssues: number;
  startYear: number;
  coverImage: string;
  description: string;
  characters: CharacterCountRef[];
};


export type VolumeState =
  | "untouched"
  | "to-read"
  | "reading"
  | "caught-up"
  | "partial"
  | "complete";


export type NextReleaseSource = "override" | "derived" | "none";

export type NextRelease = {
  date: string | null;
  source: NextReleaseSource;
};

export type VolumeSummary = Omit<VolumeDetail, "characters"> & {
  issuesKnown: number;
  read: number;
  reading: boolean;
  ongoing: boolean;
  ignored: boolean;
  state: VolumeState;
  firstReadAt: string | null;
  lastReadAt: string | null;
  favourite: boolean;
  nextRelease: NextRelease;
  tags: string[];
};

export type IssueSummary = {
  id: number; // key to link connections
  volumeId: number; // id linking Volume and Issue
  issueNumber: number;
  datePublished: string; // ex. 2022-10-01
  coverImage: string; // ling to the cover img url
  name: string;
  readAt: string | null;
};

export type IssueNeighbor = { id: number; issueNumber: number } | null;

export type CharacterRef = { id: number; name: string };

export type CharacterCountRef = CharacterRef & { count: number };

export type CharacterIssue = {
  id: number;
  issueNumber: number;
  name: string;
  datePublished: string;
  readAt: string | null;
};

export type CharacterVolumeGroup = {
  volumeId: number;
  name: string;
  startYear: number;
  coverImage: string;
  issues: CharacterIssue[];
};

export type CharacterResultRef = {
  id: number;
  name: string;
  realName: string;
  image: string;
};

export type CharacterMatch = CharacterResultRef & {
  aliases: string[];
  deck: string;
  detailCached: boolean;
  issueCount: number;
};

export type CharacterDetail = CharacterResultRef & {
  aliases: string[];
  deck: string;
  publisher: string;
  firstAppearedIn: string;
  globalAppearances: number;
  siteUrl: string;
  issueCount: number;
};

export type CharacterSearchResponse = {
  characters: CharacterResultRef[];
  volumes: CharacterVolumeGroup[];
};

export type IssueData = IssueSummary & {
  credits: PersonCredit[],
  tags: string[];
  characters: CharacterRef[];
  prevIssue: IssueNeighbor;
  nextIssue: IssueNeighbor;
};

export type PersonCredit = { id: number; name: string; roles: string[] };


export type Coverage = {
  indexedRead: number;
  readTotal: number;
};

export type CreatorMatch = {
  id: number;
  name: string;
  roles: string[];      // array on the wire
  issueCount: number;
  readCount: number;
  favourite: boolean;
};

export type RoleGroup = "writer" | "artist" | "cover";

export type SearchIssue = {
  id: number;
  issueNumber: number;
  name: string;
  datePublished: string;
  readAt: string | null;
  roles: string[];
  roleGroups: RoleGroup[];
};

export type SearchVolumeGroup = {
  volumeId: number;
  name: string;
  startYear: number;
  coverImage: string;
  issues: SearchIssue[];
};

export type CreatorMatchesResponse = {
  matches: CreatorMatch[];
  coverage: Coverage;
};

export type CreatorSearchResponse = {
  creator: { id: number; name: string; roles: string[] };
  coverage: Coverage;
  volumes: SearchVolumeGroup[];
};

export type IndexJobStatus = {
  kind: "read" | "volume" | null;
  volumeId: number | null;
  volumeName: string;
  running: boolean;
  done: number;
  total: number;
  fresh: number;
  error: string | null; 
};

export type MonthlyHistoryIssue = {
  id: number;
  issueNumber: number;
  readAt: string;
};

export type MonthlyHistoryRow = {
  month: string; // YYYY-MM
  total: number;
  volumes: {
    id: number;
    name: string;
    coverImage: string;
    count: number;
    issues: MonthlyHistoryIssue[];
  }[];
};

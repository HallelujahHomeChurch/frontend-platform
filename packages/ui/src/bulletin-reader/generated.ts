// Generated from hhc-web-api OpenAPI components. Do not edit.
export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        OnlineBulletinID: string;
        OnlineBulletinHash: string;
        /** @enum {string} */
        OnlineBulletinFontRole: "body" | "scripture" | "emphasis" | "reference" | "foreignText";
        /** @description Typed immutable content. Canonical issue metadata and mutable source asset IDs are intentionally absent. Maximum encoded size is 8 MiB; server also validates references, total collection limits and fragment coverage. */
        OnlineBulletinDocument: {
            /** Format: uuid */
            issueId: string;
            /** @constant */
            series: "general";
            /** @constant */
            contentLocale: "zh-Hant";
            /** @constant */
            schemaVersion: "1";
            /** @constant */
            templateVersion: "v1";
            sourceAssetChecksum: components["schemas"]["OnlineBulletinHash"];
            sourcePageCount: number;
            pages: components["schemas"]["OnlineBulletinPage"][];
            layoutManifest: components["schemas"]["OnlineBulletinLayoutManifest"];
            components: components["schemas"]["OnlineBulletinComponent"][];
        };
        OnlineBulletinPage: {
            id: components["schemas"]["OnlineBulletinID"];
            /** @description PDF points. */
            width: number;
            /** @description PDF points. */
            height: number;
        };
        /** @description Normalized page-relative rectangle. Server additionally rejects any edge exceeding the page boundary. */
        OnlineBulletinBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        /** @description Revision-owned manifest; hashes bind the authoritative isolated-worker measurement. Empty validation hashes represent a pending draft, never permission to publish. */
        OnlineBulletinLayoutManifest: {
            /** @constant */
            templateVersion: "v1";
            /** @constant */
            rendererVersion: "v1";
            rendererArtifactSha256: components["schemas"]["OnlineBulletinHash"];
            contentHash?: components["schemas"]["OnlineBulletinHash"];
            layoutValidationHash?: components["schemas"]["OnlineBulletinHash"];
            assets: components["schemas"]["OnlineBulletinAsset"][];
            pages: components["schemas"]["OnlineBulletinLayoutPage"][];
        };
        /** @description Code-owned permanent self-hosted asset, never an executable URL. Filename includes its exact SHA-256. */
        OnlineBulletinAsset: {
            url: string;
            sha256: components["schemas"]["OnlineBulletinHash"];
            /** @enum {string} */
            kind: "font" | "decoration";
            fontRole?: components["schemas"]["OnlineBulletinFontRole"];
        };
        OnlineBulletinLayoutPage: {
            pageId: components["schemas"]["OnlineBulletinID"];
            fixedSlots?: components["schemas"]["OnlineBulletinFixedSlot"][];
            slots: components["schemas"]["OnlineBulletinSlot"][];
        };
        OnlineBulletinSlot: {
            id: components["schemas"]["OnlineBulletinID"];
            componentId: components["schemas"]["OnlineBulletinID"];
            blockId: components["schemas"]["OnlineBulletinID"];
            box: components["schemas"]["OnlineBulletinBox"];
            continuationOf?: components["schemas"]["OnlineBulletinID"];
            fragments: components["schemas"]["OnlineBulletinFragment"][];
        };
        /** @description Template-owned geometry for a fixed label or canonical metadata reference. It contains no editable text or executable URL. */
        OnlineBulletinFixedSlot: {
            id: components["schemas"]["OnlineBulletinID"];
            /** @enum {string} */
            element: "title" | "subtitle" | "date" | "issueNumber" | "pageNumber" | "masthead" | "vision" | "pastor" | "contact" | "scanHint" | "websiteQRLabel" | "youtubeQRLabel" | "streamQRLabel" | "welcomeLabel" | "worshipLabel" | "workLabel" | "wordLabel" | "verseLabel" | "hymnLabel" | "summaryLabel" | "announcementsLabel" | "prayersLabel" | "titleLabel" | "speakerLabel" | "transcriberLabel" | "editorLabel" | "authorLabel" | "logo" | "backgroundLogo" | "websiteQR" | "youtubeQR" | "streamQR" | "topRule" | "footerRule" | "summaryFrame" | "announcementsFrame" | "prayersFrame";
            box: components["schemas"]["OnlineBulletinBox"];
            style: components["schemas"]["OnlineBulletinParagraphStyle"];
        };
        /** @description Read-only snapshot of existing CMS fields, separate from editable document content. */
        OnlineBulletinCanonicalMetadata: {
            title: string;
            subtitle: string;
            issueNumber: number;
            /** Format: date */
            date: string;
        };
        /** @description Half-open offsets in Unicode code points, not UTF-8 bytes or UTF-16 units. Coverage must be complete and non-overlapping in reading order. */
        OnlineBulletinFragment: {
            sentenceId: components["schemas"]["OnlineBulletinID"];
            start: number;
            end: number;
        };
        OnlineBulletinSpan: {
            text: string;
            fontRole: components["schemas"]["OnlineBulletinFontRole"];
            /** @description Optional source PDF-point size for mixed-size inline runs. Missing or null inherits the block size; mobile retains the proportional em ratio. */
            fontSize?: number | null;
        };
        /** @description Dynamic sentence anchor. The canonical- ID prefix is reserved for shared canonical metadata anchors across layouts. */
        OnlineBulletinSentence: {
            id: components["schemas"]["OnlineBulletinID"];
            spans: components["schemas"]["OnlineBulletinSpan"][];
            source?: {
                page: number;
                box: components["schemas"]["OnlineBulletinBox"];
            };
        };
        /** @description Font size and line height in PDF points. Indents and spacing in em units; negative first-line indentation supports hanging paragraphs. */
        OnlineBulletinParagraphStyle: {
            fontSize: number;
            lineHeight: number;
            /** @description Explicit source tracking in em; omitted means zero. Never adjusted automatically to fit edits. */
            letterSpacing?: number;
            /** @enum {string} */
            align?: "left" | "center" | "right" | "justify";
            indent: number;
            firstLineIndent: number;
            spaceBefore: number;
            spaceAfter: number;
        };
        OnlineBulletinBlock: {
            id: components["schemas"]["OnlineBulletinID"];
            style: components["schemas"]["OnlineBulletinParagraphStyle"];
            sentences: components["schemas"]["OnlineBulletinSentence"][];
        };
        OnlineBulletinItem: {
            id: components["schemas"]["OnlineBulletinID"];
            title?: components["schemas"]["OnlineBulletinBlock"];
            blocks: components["schemas"]["OnlineBulletinBlock"][];
        };
        OnlineBulletinCover: {
            welcome: components["schemas"]["OnlineBulletinBlock"][];
            worship: components["schemas"]["OnlineBulletinItem"][];
            work: components["schemas"]["OnlineBulletinItem"][];
            wordQuestions: components["schemas"]["OnlineBulletinItem"][];
            weeklyVerses: components["schemas"]["OnlineBulletinBlock"][];
        };
        OnlineBulletinBodySection: {
            /**
             * @description Unknown creates a blocking review issue.
             * @enum {string}
             */
            kind: "sermon" | "testimony" | "teaching" | "reflection" | "unknown";
            title: components["schemas"]["OnlineBulletinBlock"];
            subtitle?: components["schemas"]["OnlineBulletinBlock"];
            contributors?: {
                /** @enum {string} */
                role: "speaker" | "transcriber" | "editor" | "author";
                name: components["schemas"]["OnlineBulletinBlock"];
            }[];
            blocks: components["schemas"]["OnlineBulletinBlock"][];
        };
        OnlineBulletinHymnLyrics: {
            hymns: {
                id: components["schemas"]["OnlineBulletinID"];
                number?: components["schemas"]["OnlineBulletinBlock"];
                title: components["schemas"]["OnlineBulletinBlock"];
                sourceLabel?: components["schemas"]["OnlineBulletinBlock"];
                sections: {
                    id: components["schemas"]["OnlineBulletinID"];
                    /** @enum {string} */
                    kind: "verse" | "chorus" | "bridge";
                    lines: components["schemas"]["OnlineBulletinBlock"][];
                }[];
            }[];
        };
        OnlineBulletinComponent: components["schemas"]["OnlineBulletinCoverComponent"] | components["schemas"]["OnlineBulletinBodyComponent"] | components["schemas"]["OnlineBulletinHymnComponent"] | components["schemas"]["OnlineBulletinBackComponent"];
        OnlineBulletinCoverComponent: {
            id: components["schemas"]["OnlineBulletinID"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "cover";
            cover: components["schemas"]["OnlineBulletinCover"];
        };
        OnlineBulletinBodyComponent: {
            id: components["schemas"]["OnlineBulletinID"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "bodySection";
            bodySection: components["schemas"]["OnlineBulletinBodySection"];
        };
        OnlineBulletinHymnComponent: {
            id: components["schemas"]["OnlineBulletinID"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "hymnLyrics";
            hymnLyrics: components["schemas"]["OnlineBulletinHymnLyrics"];
        };
        OnlineBulletinBackComponent: {
            id: components["schemas"]["OnlineBulletinID"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "backSummary" | "announcements" | "victoriesAndPrayers";
            items: components["schemas"]["OnlineBulletinItem"][];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;

// Generated from hhc-web-api OpenAPI components. Do not edit.
export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        OnlineBulletinComparisonValue: components["schemas"]["OnlineBulletinBlock"] | components["schemas"]["OnlineBulletinComponent"] | components["schemas"]["OnlineBulletinID"][] | null;
        OnlineBulletinComparison: {
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            version: number;
            /** Format: int64 */
            canonicalVersion: number;
            /** Format: int64 */
            baseRevision: number;
            /** Format: int64 */
            localRevision: number;
            /** Format: int64 */
            incomingRevision: number;
            units: {
                componentId: string;
                blockId: string;
                /** @enum {string} */
                suggestion: "same" | "local" | "incoming" | "conflict";
                base: components["schemas"]["OnlineBulletinComparisonValue"];
                local: components["schemas"]["OnlineBulletinComparisonValue"];
                incoming: components["schemas"]["OnlineBulletinComparisonValue"];
            }[];
        };
        OnlineBulletinCompareInput: {
            /** Format: int64 */
            canonicalVersion: number;
            /** Format: int64 */
            baseRevision: number;
            /** Format: int64 */
            localRevision: number;
            /** Format: int64 */
            incomingRevision: number;
            choices?: ({
                componentId: string;
                blockId: string;
                /** @enum {string} */
                choice: "local" | "incoming" | "manual";
                value?: components["schemas"]["OnlineBulletinComparisonValue"];
            } & ({
                /** @constant */
                choice?: "manual";
            } | {
                /** @enum {unknown} */
                choice?: "local" | "incoming";
            }))[];
        };
        OnlineBulletinDraftInput: {
            /** Format: int64 */
            canonicalVersion: number;
            /** @description Typed editable content only. Omit every read-only sentence source field; the server preserves source provenance by stable sentence ID. */
            components: components["schemas"]["OnlineBulletinComponent"][];
        };
        OnlineBulletinSavedDraft: {
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            version: number;
            /** Format: int64 */
            revision: number;
            /** Format: uuid */
            layoutJobId: string;
        };
        OnlineBulletinExtractionInput: {
            /** Format: int64 */
            canonicalVersion: number;
            /** @default false */
            retry: boolean;
        };
        OnlineBulletinQueuedExtractionEnvelope: {
            data: {
                /** Format: uuid */
                documentId: string;
                /** Format: int64 */
                version: number;
                job: components["schemas"]["OnlineBulletinAdminJob"];
            };
            meta: {
                [key: string]: unknown;
            };
            error: null;
        };
        OnlineBulletinRevisionPage: {
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            nextBefore: number | null;
            items: {
                /** Format: int64 */
                revision: number;
                createdBy: string;
                /** Format: date-time */
                createdAt: string;
                sourceAssetChecksum: string;
                /** @description Historical worker proof exists; not current publication authority. */
                layoutValidated: boolean;
            }[];
        };
        OnlineBulletinHistoricalRevision: {
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            revision: number;
            document: components["schemas"]["OnlineBulletinDocument"];
            reviewIssues: components["schemas"]["OnlineBulletinReviewIssue"][];
            canonicalMetadata: components["schemas"]["OnlineBulletinCanonicalMetadata"];
            createdBy: string;
            /** Format: date-time */
            createdAt: string;
        };
        OnlineBulletinPublishInput: {
            /** Format: int64 */
            canonicalVersion: number;
            /** Format: int64 */
            revision: number;
            mappings?: components["schemas"]["OnlineBulletinSentenceMapping"][];
        };
        OnlineBulletinSentenceMapping: {
            fromSentenceId: string;
            /** @enum {string} */
            status: "unchanged" | "moved" | "split" | "merged" | "removed";
            toSentenceIds: string[];
        };
        OnlineBulletinUnpublishedRevision: {
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            version: number;
        };
        OnlineBulletinRestoreInput: {
            /** Format: int64 */
            canonicalVersion: number;
        };
        OnlineBulletinConfirmInput: {
            /** Format: int64 */
            canonicalVersion: number;
            /** Format: int64 */
            revision: number;
            layoutValidationHash: string;
            pageCount: number;
            acceptedIssues: components["schemas"]["OnlineBulletinReviewIssue"][];
        };
        OnlineBulletinConfirmedRevision: {
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            version: number;
            /** Format: int64 */
            revision: number;
        };
        /** @description Latest non-superseded conversion provenance; Admin only. A resultRevision may be Incoming rather than the adopted Local baseline. stale compares the current source revision, hash and canonical metadata. */
        OnlineBulletinDerivation: {
            /** Format: uuid */
            sourceDocumentId: string;
            /** Format: int64 */
            sourceRevision: number;
            sourceContentHash: string;
            /** Format: int64 */
            sourceMetadataVersion: number;
            converterVersion: string;
            /** Format: int64 */
            resultRevision: number | null;
            convertedMetadata: null | components["schemas"]["OnlineBulletinCanonicalMetadata"];
            stale: boolean;
        };
        OnlineBulletinConversionInput: {
            /** Format: int64 */
            canonicalVersion: number;
            /** Format: int64 */
            sourceOnlineVersion: number;
            /** Format: int64 */
            sourceRevision: number;
            /** @default false */
            retry: boolean;
        };
        OnlineBulletinAdminState: {
            /** Format: uuid */
            issueId: string;
            /** @enum {string} */
            series: "general";
            /** @enum {string} */
            contentLocale: "zh-Hant" | "zh-Hans";
            /** Format: int64 */
            canonicalVersion: number;
            canonicalMetadata: components["schemas"]["OnlineBulletinCanonicalMetadata"];
            pdfStatus: components["schemas"]["BulletinVersionStatus"];
            documentId: string;
            /** Format: int64 */
            version: number;
            /** @enum {string} */
            draftStatus: "notStarted" | "extracting" | "reviewRequired" | "ready" | "published" | "extractionFailed";
            /** Format: int64 */
            baseRevision: number | null;
            /** Format: int64 */
            incomingRevision: number | null;
            /** Format: int64 */
            publishedRevision: number | null;
            /** @description Canonical metadata differs from the immutable Online publication and requires explicit republish. */
            metadataSyncPending: boolean;
            conversion?: components["schemas"]["OnlineBulletinAdminJob"];
            derivation?: components["schemas"]["OnlineBulletinDerivation"];
            /** @description Human confirmation matches current Local and canonical metadata. This does not itself authorize publication. */
            confirmed: boolean;
            publishedMetadata: null | components["schemas"]["OnlineBulletinCanonicalMetadata"];
            local: null | components["schemas"]["OnlineBulletinAdminRevision"];
            extraction: null | components["schemas"]["OnlineBulletinAdminJob"];
            layout: null | components["schemas"]["OnlineBulletinAdminJob"];
        };
        OnlineBulletinAdminRevision: {
            /** Format: int64 */
            revision: number;
            document: components["schemas"]["OnlineBulletinDocument"];
            reviewIssues: components["schemas"]["OnlineBulletinReviewIssue"][];
        };
        OnlineBulletinReviewIssue: {
            code: string;
            blocking: boolean;
            componentId?: components["schemas"]["OnlineBulletinID"];
        };
        OnlineBulletinAdminJob: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "queued" | "parsing" | "converting" | "review_ready" | "validating" | "ready" | "failed";
            attempts: number;
            errorCode: string;
            reviewIssues?: components["schemas"]["OnlineBulletinReviewIssue"][];
        };
        OnlineBulletinID: string;
        OnlineBulletinHash: string;
        /** @enum {string} */
        OnlineBulletinFontRole: "body" | "scripture" | "emphasis" | "reference" | "foreignText" | "symbol";
        /** @description Typed immutable content. Canonical issue metadata and mutable source asset IDs are intentionally absent. Maximum encoded size is 8 MiB; server also validates references, total collection limits and fragment coverage. */
        OnlineBulletinDocument: {
            /** Format: uuid */
            issueId: string;
            /** @constant */
            series: "general";
            /** @enum {string} */
            contentLocale: "zh-Hant" | "zh-Hans";
            /** @constant */
            schemaVersion: "1";
            /** @enum {string} */
            templateVersion: "v1" | "v2";
            sourceAssetChecksum: components["schemas"]["OnlineBulletinHash"];
            /** @description Must equal the saved page count. Composition preserves original page identity and fragment membership; overflow blocks publication instead of adding pages. */
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
            /** @enum {string} */
            templateVersion: "v1" | "v2";
            /**
             * @description V3 and V4 use the existing v1 Traditional or v2 Simplified template with adaptive composition and painted-text validation. V4 permits a safe 24-point bottom margin for dense pages. Existing published renderer versions remain immutable.
             * @enum {string}
             */
            rendererVersion: "v1" | "v2" | "v3" | "v4";
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
            element: "title" | "subtitle" | "date" | "issueNumber" | "pageNumber" | "masthead" | "vision" | "visionMission" | "visionFellowship" | "visionCommitment" | "pastor" | "contact" | "scanHint" | "websiteQRLabel" | "youtubeQRLabel" | "streamQRLabel" | "welcomeLabel" | "worshipLabel" | "workLabel" | "wordLabel" | "verseLabel" | "hymnLabel" | "summaryLabel" | "summarySidebarTitle" | "summarySidebarTagline" | "announcementsLabel" | "prayersLabel" | "titleLabel" | "speakerLabel" | "speakerSeparator" | "lectureDateMarker" | "bodyIssueSummary" | "bodySpeakerLabel" | "transcriberLabel" | "editorLabel" | "authorLabel" | "logo" | "backgroundLogo" | "websiteQR" | "youtubeQR" | "streamQR" | "topRule" | "footerRule" | "summaryFrame" | "announcementsFrame" | "prayersFrame";
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
            /** @description Server-owned PDF provenance; forbidden in component edit requests. */
            readonly source?: {
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
            header?: components["schemas"]["OnlineBulletinBodyHeader"];
            title: components["schemas"]["OnlineBulletinBlock"];
            subtitle?: components["schemas"]["OnlineBulletinBlock"];
            contributors?: {
                /** @enum {string} */
                role: "speaker" | "transcriber" | "editor" | "author";
                name: components["schemas"]["OnlineBulletinBlock"];
            }[];
            blocks: components["schemas"]["OnlineBulletinBlock"][];
        };
        /** @description First body section only. Source lecture date is independent of canonical issue publication date; all fields use sentence anchors. Missing contributor roles block publication review. */
        OnlineBulletinBodyHeader: {
            lectureDate: components["schemas"]["OnlineBulletinBlock"];
            contributors: {
                /** @enum {string} */
                role: "speaker" | "transcriber" | "editor";
                name: components["schemas"]["OnlineBulletinBlock"];
            }[];
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
        /** @enum {string} */
        BulletinVersionStatus: "draft" | "publishing" | "published" | "unpublishing" | "unpublish_failed" | "unpublished";
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;

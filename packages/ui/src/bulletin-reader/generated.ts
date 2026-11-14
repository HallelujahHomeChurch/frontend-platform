// Generated from hhc-web-api OpenAPI components. Do not edit.
export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        BulletinTemplateSettings: {
            /** Format: int64 */
            version: number;
            visionMission: string;
            visionFellowship: string;
            visionCommitment: string;
        };
        OnlineBulletinLearningRule: {
            signature: string;
            /** Format: int64 */
            version: number;
            /** @enum {string} */
            status: "pending" | "active" | "conflicted" | "disabled";
            /** @enum {string} */
            kind: "sermon" | "testimony" | "teaching" | "reflection";
            title: string;
            speaker: string;
            confirmedIssues: number;
            conflicted: boolean;
        };
        OnlineBulletinLearningRulePage: {
            items: components["schemas"]["OnlineBulletinLearningRule"][];
            nextCursor?: string;
        };
        OnlineBulletinLearningRuleRevision: {
            /** Format: int64 */
            version: number;
            /** @enum {string} */
            status: "pending" | "active" | "conflicted" | "disabled";
            /** @enum {string} */
            kind: "sermon" | "testimony" | "teaching" | "reflection";
            createdBy: string;
            /** Format: date-time */
            createdAt: string;
        };
        OnlineBulletinLearningExample: {
            /** Format: uuid */
            issueId: string;
            issueNumber: number;
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            revision: number;
            /**
             * Format: int64
             * @description Latest confirmation replacing this historical vote. Omitted for current evidence.
             */
            supersededByRevision?: number;
            componentId: components["schemas"]["OnlineBulletinID"];
            sourcePage: number;
            /** @enum {string} */
            kind: "sermon" | "testimony" | "teaching" | "reflection";
            createdBy: string;
            /** Format: date-time */
            createdAt: string;
        };
        OnlineBulletinLearningRuleDetail: {
            rule: components["schemas"]["OnlineBulletinLearningRule"];
            revisions: components["schemas"]["OnlineBulletinLearningRuleRevision"][];
            examples: components["schemas"]["OnlineBulletinLearningExample"][];
        };
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
                /** @description Images from a replaced source must be selected again from the current PDF. */
                sourceRepairRequired?: boolean;
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
            /**
             * @description Authorize verified current-source PDF and online publication; requires cms:bulletins:publish in addition to write. Explicit draft or unpublish cancels this intent.
             * @default false
             */
            autoPublish: boolean;
            /**
             * @description Requires autoPublish; retains existing once-per-issue notification policy.
             * @default false
             */
            notifySubscribers: boolean;
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
        OnlineBulletinAutomation: {
            disposition?: components["schemas"]["PublicationDisposition"];
            autoPublish: boolean;
            summary: string;
            /** @enum {string} */
            changeKind: "" | "first" | "unchanged" | "layout" | "correction" | "structure";
            update: null | {
                /** Format: uuid */
                id: string;
                /** @enum {string} */
                status: "queued" | "planning" | "ready" | "failed" | "superseded";
                attempts: number;
                errorCode: string;
                /** Format: int64 */
                resultRevision: number | null;
            };
        };
        OnlineBulletinAdminState: {
            derivedPublication?: components["schemas"]["OnlineBulletinDerivedPublication"];
            notification?: components["schemas"]["OnlineBulletinInitialNotification"];
            capabilities?: components["schemas"]["OnlineBulletinCapabilities"];
            production?: components["schemas"]["OnlineBulletinProduction"];
            automation?: components["schemas"]["OnlineBulletinAutomation"];
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
            blockId?: components["schemas"]["OnlineBulletinID"];
            sentenceId?: components["schemas"]["OnlineBulletinID"];
            /** @description Validated fixed template element at the failing layout location. This diagnostic cannot be waived. */
            fixedElement?: components["schemas"]["OnlineBulletinID"];
            /** @description One-based original PDF page, never the composed online page index. Omitted when no exact source page is available. */
            sourcePage?: number;
        };
        OnlineBulletinAdminJob: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "queued" | "parsing" | "converting" | "review_ready" | "validating" | "ready" | "failed";
            /** @description This extraction job's saved candidate revision. Null means no saved candidate; omitted by older producers means unknown. Never infer this from the current Local or Incoming pointer. */
            resultRevision?: number | null;
            attempts: number;
            errorCode: string;
            /** @description Extraction, current saved-draft layout, or Simplified conversion diagnostics. Layout findings are non-waivable and reference original PDF pages and content IDs when available. Conversion locations refer to the immutable Traditional source revision recorded by the derivation. */
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
            /** @description Immutable issue-owned settings captured when queued. Required by V9 and V10; earlier renderers do not carry a snapshot. Simplified values are server-derived by OpenCC, with the same settings version. Never editable through draft components. */
            templateSnapshot?: components["schemas"]["BulletinTemplateSettings"] & {
                version?: unknown;
            };
            sourceAssetChecksum: components["schemas"]["OnlineBulletinHash"];
            /** @description Must equal the saved page count. Composition preserves original page identity and fragment membership; overflow blocks publication instead of adding pages. */
            sourcePageCount: number;
            pages: components["schemas"]["OnlineBulletinPage"][];
            layoutManifest: components["schemas"]["OnlineBulletinLayoutManifest"];
            components: components["schemas"]["OnlineBulletinComponent"][];
        } & unknown;
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
             * @description Adaptive renderers retain the v1 Traditional or v2 Simplified template. V4 permits a safe 24-point bottom margin for dense body pages; V5 extends this to complete covers. V6 adds historical four-row cover profiles; V7 preserves proportional inline font sizes during cover composition. V8 fits titles at normal tracking and keeps heading-speaker rows and cover date-issue rows together. V9 consumes an immutable issue-owned template snapshot. V10 reuses V9 paper rendering and adds bounded measured dense-cover composition with separate long title/subtitle rows and a 9-point cover text floor. Existing published renderer versions remain immutable.
             * @enum {string}
             */
            rendererVersion: "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8" | "v9" | "v10" | "v11";
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
            /**
             * @description Historical elements require rendererVersion v6, v7 or v8; historicalGospelGoals preserves the reviewed native gospel-wording variant instead of substituting historicalGoals.
             * @enum {string}
             */
            element: "title" | "subtitle" | "date" | "issueNumber" | "pageNumber" | "masthead" | "vision" | "visionMission" | "visionFellowship" | "visionCommitment" | "historicalVision" | "historicalGoals" | "historicalGospelGoals" | "historicalActions" | "historicalCommitment" | "pastor" | "contact" | "scanHint" | "websiteQRLabel" | "youtubeQRLabel" | "streamQRLabel" | "welcomeLabel" | "worshipLabel" | "workLabel" | "wordLabel" | "verseLabel" | "hymnLabel" | "summaryLabel" | "summarySidebarTitle" | "summarySidebarTagline" | "announcementsLabel" | "prayersLabel" | "titleLabel" | "speakerLabel" | "speakerSeparator" | "lectureDateMarker" | "bodyIssueSummary" | "bodySpeakerLabel" | "transcriberLabel" | "editorLabel" | "authorLabel" | "logo" | "backgroundLogo" | "websiteQR" | "youtubeQR" | "streamQR" | "topRule" | "footerRule" | "summaryFrame" | "announcementsFrame" | "prayersFrame";
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
        /** @description Source-linked private raster illustration; owned Asset references are server-only and sanitized PNG pixels are authorized response-only. */
        OnlineBulletinIllustration: {
            id: components["schemas"]["OnlineBulletinHash"];
            componentId: components["schemas"]["OnlineBulletinID"];
            afterBlockId?: components["schemas"]["OnlineBulletinID"];
            pageId: components["schemas"]["OnlineBulletinID"];
            box: components["schemas"]["OnlineBulletinBox"];
            alt: string;
            /**
             * Format: uuid
             * @description Server-owned private reference, omitted from member responses.
             */
            assetId?: string;
            sha256: components["schemas"]["OnlineBulletinHash"];
            sizeBytes: number;
            /** @description Authorized response-only sanitized PNG base64; never stored in documents. */
            png?: string;
        };
        OnlineBulletinSourcePart: {
            id: components["schemas"]["OnlineBulletinHash"];
            /** Format: byte */
            png?: string;
            available: boolean;
            /** @enum {string} */
            kind: "text" | "image";
            page: number;
            box: components["schemas"]["OnlineBulletinBox"];
            text?: string;
            /** @enum {string} */
            fontRole?: "body" | "scripture" | "emphasis";
        };
        OnlineBulletinSourceRepairCatalog: {
            /** Format: uuid */
            documentId: string;
            version: number;
            revision: number;
            canonicalVersion: number;
            sourceChecksum: components["schemas"]["OnlineBulletinHash"];
            parts: components["schemas"]["OnlineBulletinSourcePart"][];
        };
        /** @description Select exact server-catalogued source material; no text, coordinates, Asset identifiers or proof may be supplied. */
        OnlineBulletinSourceRepairInput: {
            /** @description Remove this previously restored source illustration. */
            remove?: boolean;
            canonicalVersion: number;
            revision: number;
            sourceChecksum: components["schemas"]["OnlineBulletinHash"];
            partId: components["schemas"]["OnlineBulletinHash"];
            componentId: components["schemas"]["OnlineBulletinID"];
            afterBlockId?: components["schemas"]["OnlineBulletinID"];
            alt?: string;
            /** @enum {string} */
            fontRole?: "body" | "scripture" | "emphasis";
        };
        OnlineBulletinSourceRepairResult: {
            /** @constant */
            status: "saved";
            draft: components["schemas"]["OnlineBulletinSavedDraft"];
        } | {
            /** @constant */
            status: "waitingForScan";
        };
        OnlineBulletinComponent: components["schemas"]["OnlineBulletinCoverComponent"] | components["schemas"]["OnlineBulletinBodyComponent"] | components["schemas"]["OnlineBulletinHymnComponent"] | components["schemas"]["OnlineBulletinBackComponent"];
        OnlineBulletinCoverComponent: {
            illustrations?: components["schemas"]["OnlineBulletinIllustration"][];
            id: components["schemas"]["OnlineBulletinID"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "cover";
            cover: components["schemas"]["OnlineBulletinCover"];
        };
        OnlineBulletinBodyComponent: {
            illustrations?: components["schemas"]["OnlineBulletinIllustration"][];
            id: components["schemas"]["OnlineBulletinID"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "bodySection";
            bodySection: components["schemas"]["OnlineBulletinBodySection"];
        };
        OnlineBulletinHymnComponent: {
            illustrations?: components["schemas"]["OnlineBulletinIllustration"][];
            id: components["schemas"]["OnlineBulletinID"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "hymnLyrics";
            hymnLyrics: components["schemas"]["OnlineBulletinHymnLyrics"];
        };
        OnlineBulletinBackComponent: {
            illustrations?: components["schemas"]["OnlineBulletinIllustration"][];
            id: components["schemas"]["OnlineBulletinID"];
            /**
             * @description discriminator enum property added by openapi-typescript
             * @enum {string}
             */
            type: "backSummary" | "announcements" | "victoriesAndPrayers";
            items: components["schemas"]["OnlineBulletinItem"][];
        };
        OnlineBulletinCapabilities: {
            /** @description Inactive until every publisher and worker supports durable intent epochs. */
            explicitOnlinePublication: boolean;
            qualifiedDraftRecovery: boolean;
            /** @description Default-off dedicated saved-proof Simplified recovery capability. */
            simplifiedPublicationRecovery?: boolean;
        };
        /** @enum {string} */
        OnlineBulletinRecoveryBlocker: "missing_local" | "pdf_not_published" | "source_changed" | "stale_metadata" | "review_required" | "incompatible_proof" | "layout_not_ready" | "semantic_proof_missing";
        OnlineBulletinRecoveryBlockedEnvelope: {
            data: null;
            meta: {
                blockers: components["schemas"]["OnlineBulletinRecoveryBlocker"][];
            };
            error: {
                /** @constant */
                code: "recovery_blocked";
                message: string;
            };
        };
        OnlineBulletinRecoveryInput: {
            /** Format: int64 */
            canonicalVersion: number;
            /** Format: int64 */
            revision: number;
            layoutValidationHash: string;
        };
        OnlineBulletinRecoveryReceipt: {
            /** Format: uuid */
            id: string;
            operationKey: string;
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            revision: number;
            /** Format: int64 */
            canonicalVersion: number;
            /** Format: int64 */
            onlineVersion: number;
            layoutValidationHash: string;
            /** @enum {string} */
            outcome: "published";
            /** Format: date-time */
            createdAt: string;
        };
        OnlineBulletinRecoveryResult: {
            receipt: components["schemas"]["OnlineBulletinRecoveryReceipt"];
            publication: components["schemas"]["OnlineBulletinConfirmedRevision"];
            /** @description Returns the immutable original outcome after withdrawal without publishing again. */
            replayed: boolean;
        };
        /** @description Admin-only progress currently reports scan, recognition and reconciliation. Layout and publication enum values are reserved; existing layout/publication fields remain the authority for later stages. Verification subphase is reserved. Progress never qualifies content for publication. */
        OnlineBulletinProduction: {
            sourceIdentity: string;
            /** Format: uuid */
            jobId: string;
            attemptId: string;
            /** Format: int64 */
            progressVersion: number;
            /** @enum {string} */
            phase: "scan" | "recognition" | "reconciliation" | "layout" | "publication";
            /** @enum {string} */
            status: "queued" | "running" | "waiting" | "completed" | "failed" | "cancelled" | "superseded";
            totalPages: number | null;
            currentPage: number | null;
            verifiedPages: number;
            /** @enum {string} */
            subphase: "" | "source" | "recognition" | "verification" | "verified" | "checkpoint_reuse" | "snapshot_reuse";
            /** Format: date-time */
            startedAt: string | null;
            /** Format: date-time */
            lastProgressAt: string | null;
            /** Format: date-time */
            heartbeatAt: string | null;
            /** Format: date-time */
            observedAt: string;
            verifiedReuseCount: number;
        };
        OnlineBulletinSimplifiedRecoveryBlockedEnvelope: {
            data: null;
            meta: {
                blockers: components["schemas"]["OnlineBulletinSimplifiedRecoveryBlocker"][];
            };
            error: {
                /** @constant */
                code: "recovery_blocked";
                message: string;
            };
        };
        /** @enum {string} */
        OnlineBulletinSimplifiedRecoveryBlocker: "publication_intent_missing" | "missing_local" | "source_changed" | "review_required" | "incompatible_proof" | "semantic_proof_missing" | "layout_not_ready" | "stale_metadata" | "mapping_review_required";
        OnlineBulletinSimplifiedRecoverySource: {
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            revision: number;
            contentHash: string;
            /** Format: int64 */
            onlineVersion: number;
        };
        OnlineBulletinSimplifiedRecoveryRequest: {
            /** Format: uuid */
            targetDocumentId: string;
            /** Format: int64 */
            canonicalVersion: number;
            source: components["schemas"]["OnlineBulletinSimplifiedRecoverySource"];
            /** Format: uuid */
            publicationOperationId: string;
            /** Format: int64 */
            revision: number;
            layoutValidationHash: string;
        };
        OnlineBulletinSimplifiedRecoveryReceipt: {
            /** Format: uuid */
            id: string;
            operationKey: string;
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            revision: number;
            /** Format: int64 */
            canonicalVersion: number;
            /** Format: int64 */
            onlineVersion: number;
            layoutValidationHash: string;
            /** @enum {string} */
            outcome: "published";
            /** Format: date-time */
            createdAt: string;
            source: components["schemas"]["OnlineBulletinSimplifiedRecoverySource"];
            /** Format: uuid */
            publicationOperationId: string;
            /** Format: uuid */
            authorizationId: string;
        };
        OnlineBulletinSimplifiedRecoveryResult: {
            receipt: components["schemas"]["OnlineBulletinSimplifiedRecoveryReceipt"];
            publication: components["schemas"]["OnlineBulletinConfirmedRevision"];
            /** @description Original immutable historical outcome, independent of current availability. */
            replayed: boolean;
        };
        OnlineBulletinSimplifiedPublicationSource: {
            /** Format: uuid */
            documentId: string;
            /** Format: int64 */
            revision: number;
            contentHash: string | null;
            metadataHash: string | null;
        };
        OnlineBulletinSimplifiedPublicationFailure: {
            /** @enum {string} */
            code: "simplified_publication_failed" | "simplified_conversion_failed" | "simplified_layout_failed" | "simplified_target_changed" | "simplified_review_required" | "simplified_mapping_review_required" | "source_publication_changed" | "publication_withdrawn" | "stale_metadata" | "publication_authority_superseded";
            /** @enum {string} */
            kind: "failure" | "cancelled" | "superseded";
            /** @enum {string} */
            phase: "conversion" | "assessment" | "layout" | "publication" | "unknown";
            /** Format: date-time */
            at: string;
            attempts: number;
        };
        /** @enum {string} */
        OnlineBulletinSimplifiedPublicationErrorCode: "" | "simplified_publication_failed" | "simplified_conversion_failed" | "simplified_layout_failed" | "simplified_target_changed" | "simplified_review_required" | "simplified_mapping_review_required" | "source_publication_changed" | "publication_withdrawn" | "stale_metadata" | "publication_authority_superseded";
        OnlineBulletinSimplifiedPublicationRecovery: {
            /** Format: uuid */
            authorizationId: string;
            /** Format: uuid */
            receiptId: string;
            /** Format: int64 */
            revision: number;
            /** Format: date-time */
            createdAt: string;
        };
        /** @description Original automatic source-bound operation history; completed and human recovery receipts never prove current Hans availability. Counts cover only tracked history, with unknown legacy facts nullable. */
        OnlineBulletinDerivedPublication: {
            /** Format: uuid */
            operationId: string;
            source: components["schemas"]["OnlineBulletinSimplifiedPublicationSource"];
            /** @description True only for the complete proven Published revision/hash/frozen metadata tuple; false for proven change; null for insufficient legacy evidence. */
            sourceCurrent: boolean | null;
            /** @enum {string} */
            status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "superseded" | "unknown";
            /** @enum {string} */
            phase: "waiting" | "conversion" | "assessment" | "layout" | "publication" | "complete" | "unknown";
            /** Format: uuid */
            conversionJobId: string | null;
            /** Format: int64 */
            resultRevision: number | null;
            /** @description Current retry budget count, never lifetime history count. */
            attempts: number | null;
            /**
             * Format: int64
             * @description Tracked kind=failure records only; excludes cancelled and superseded.
             */
            failureCount: number | null;
            /** Format: date-time */
            createdAt: string | null;
            /** Format: date-time */
            updatedAt: string | null;
            /** Format: date-time */
            nextAttemptAt: string | null;
            errorCode: components["schemas"]["OnlineBulletinSimplifiedPublicationErrorCode"];
            lastFailure: components["schemas"]["OnlineBulletinSimplifiedPublicationFailure"] | null;
            history: components["schemas"]["OnlineBulletinSimplifiedPublicationFailure"][];
            hasMore: boolean;
            /** @enum {string} */
            historyCoverage: "complete" | "partial" | "unknown";
            recovery: components["schemas"]["OnlineBulletinSimplifiedPublicationRecovery"] | null;
        };
        /** @description Exact initial generation-zero command for this issue/series. Accepted means downstream command acceptance, never email/push delivery. Later manual generations do not replace it; overloaded outbox aggregate_version never implies canonical/source version. */
        OnlineBulletinInitialNotification: {
            /** Format: uuid */
            id: string;
            /**
             * Format: int64
             * @constant
             */
            generation: 0;
            /** @enum {string} */
            status: "pending" | "processing" | "accepted" | "failed" | "unknown";
            attempts: number | null;
            /** @enum {string} */
            errorCode: "" | "notification_submission_failed";
            /** Format: int64 */
            canonicalVersion: number | null;
            /** Format: date-time */
            createdAt: string | null;
            /** Format: date-time */
            updatedAt: string | null;
            /** Format: date-time */
            nextAttemptAt: string | null;
        };
        /** @description Latest append-only disposition for a known intent. Omitted for legacy history without evidence; a false autoPublish flag never implies a historical cancellation reason. */
        PublicationDisposition: {
            /** Format: uuid */
            intentId: string;
            /** Format: int64 */
            epoch: number;
            /** @enum {string} */
            status: "authorized" | "running" | "completed" | "cancelled" | "superseded" | "failed";
            /** @enum {string} */
            reasonCode: "automatic_authorized" | "automatic_running" | "automatic_published" | "pdf_only" | "source_replaced" | "canonical_edited" | "draft_edited" | "explicit_draft" | "unpublished" | "manual_published" | "recovery_authorized" | "recovery_started" | "recovery_published" | "processing_failed" | "manual_state_change";
            /** Format: date-time */
            changedAt: string;
            /** Format: int64 */
            canonicalVersion: number;
            sourceAssetId: string;
            sourceChecksum: string;
            /** Format: uuid */
            documentId?: string;
            /** Format: int64 */
            revision?: number;
            /** Format: uuid */
            receiptId?: string;
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

INSERT INTO "TicketMessage" (
    "id",
    "ticketId",
    "senderId",
    "message",
    "createdAt"
)
SELECT
    LOWER(CONCAT(
        SUBSTRING(id_source FROM 1 FOR 8), '-',
        SUBSTRING(id_source FROM 9 FOR 4), '-',
        SUBSTRING(id_source FROM 13 FOR 4), '-',
        SUBSTRING(id_source FROM 17 FOR 4), '-',
        SUBSTRING(id_source FROM 21 FOR 12)
    )) AS "id",
    "ticketId",
    "senderId",
    "message",
    "createdAt"
FROM (
    SELECT
        MD5(st.id || st."userId" || st."createdAt"::TEXT) AS id_source,
        st.id AS "ticketId",
        st."userId" AS "senderId",
        st.message AS "message",
        st."createdAt" AS "createdAt"
    FROM "SupportTicket" st
    WHERE NOT EXISTS (
        SELECT 1
        FROM "TicketMessage" tm
        WHERE tm."ticketId" = st.id
    )
) backfill;

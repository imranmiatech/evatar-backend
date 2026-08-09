ALTER TABLE "SupportTicket" ADD COLUMN "ticketId" TEXT;

WITH numbered_tickets AS (
    SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY "createdAt", id) + 1000 AS ticket_number
    FROM "SupportTicket"
)
UPDATE "SupportTicket" st
SET "ticketId" = 'TX-' || numbered_tickets.ticket_number::TEXT
FROM numbered_tickets
WHERE st.id = numbered_tickets.id;

ALTER TABLE "SupportTicket" ALTER COLUMN "ticketId" SET NOT NULL;
CREATE UNIQUE INDEX "SupportTicket_ticketId_key" ON "SupportTicket"("ticketId");

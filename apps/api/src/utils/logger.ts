import { getSimplePrettyTerminal } from "@loglayer/transport-simple-pretty-terminal";
import { type ILogLayer, LogLayer } from "loglayer";
import { serializeError } from "serialize-error";

const transport = getSimplePrettyTerminal({ runtime: "node" });

export const logger = new LogLayer({
	transport,
	contextFieldName: "context",
	metadataFieldName: "metadata",
	errorFieldName: "err",
	errorSerializer: serializeError,
	copyMsgOnOnlyError: true,
});

export function getLogger(): ILogLayer {
	return logger;
}

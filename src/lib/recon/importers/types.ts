export type IngestMessage = {
  level: "INFO" | "WARN" | "ERROR";
  code: string;
  message: string;
};

export type IngestReport = {
  sourceFileId: string;
  insertedRawRows: number;
  insertedDomainRows?: number;
  warnings: number;
  errors: number;
};

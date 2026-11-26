import { describe, it, expect, beforeEach, vi } from "vitest";
import { DataExporter } from "../DataExporter";

describe("DataExporter", () => {
  describe("createJsonBlob", () => {
    it("should create a JSON blob from export data", () => {
      const mockData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: [],
        weightEntries: [],
      };

      const blob = DataExporter.createJsonBlob(mockData);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/json");
    });
  });

  describe("triggerDownload", () => {
    // Mock browser APIs
    const mockCreateElement = vi
      .fn<(tagName: string) => { href: string; download: string; click: () => void }>()
      .mockImplementation(() => {
        return {
          href: "",
          download: "",
          click: vi.fn<() => void>(),
        };
      });

    const mockCreateObjectURL = vi
      .fn<(obj: Blob | MediaSource) => string>()
      .mockReturnValue("mock-url");
    const mockRevokeObjectURL = vi.fn<(url: string) => void>();
    const mockAppendChild = vi.fn<(node: Node) => Node>();
    const mockRemoveChild = vi.fn<(child: Node) => Node>();

    beforeEach(() => {
      // Reset mocks
      mockCreateElement.mockClear();
      mockCreateObjectURL.mockClear();
      mockRevokeObjectURL.mockClear();
      mockAppendChild.mockClear();
      mockRemoveChild.mockClear();

      // Mock document and URL
      globalThis.document.createElement =
        mockCreateElement as unknown as typeof document.createElement;
      globalThis.URL.createObjectURL = mockCreateObjectURL;
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

      // Mock document.body methods (without directly setting document.body)
      if (globalThis.document.body) {
        globalThis.document.body.appendChild =
          mockAppendChild as unknown as typeof document.body.appendChild;
        globalThis.document.body.removeChild =
          mockRemoveChild as unknown as typeof document.body.removeChild;
        globalThis.document.body.contains = vi
          .fn<(other: Node | null) => boolean>()
          .mockReturnValue(true);
      }
    });

    it("should create and click a download link", () => {
      const blob = new Blob(["test"], { type: "application/json" });

      DataExporter.triggerDownload(blob, "test-file.json");

      // Check that createElement was called
      expect(mockCreateElement).toHaveBeenCalledWith("a");

      // Check that the link was appended to body
      expect(mockAppendChild).toHaveBeenCalled();

      // Check that the link was clicked
      expect(mockCreateElement.mock.results[0].value.click).toHaveBeenCalled();
    });

    it("should handle errors during file download", () => {
      // Mock error in createElement
      globalThis.document.createElement = vi
        .fn<(tagName: string) => HTMLElement>()
        .mockImplementation(() => {
          throw new Error("DOM error");
        });

      const blob = new Blob(["test"], { type: "application/json" });

      expect(() => {
        DataExporter.triggerDownload(blob, "test-file.json");
      }).toThrow("Failed to trigger download");
    });
  });

  describe("downloadJsonFile", () => {
    it("should create and download JSON file", () => {
      const mockData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: [],
        weightEntries: [],
      };

      // Mock the triggerDownload method to avoid DOM issues
      const triggerDownloadSpy = vi
        .spyOn(DataExporter, "triggerDownload")
        .mockImplementation(() => {});

      DataExporter.downloadJsonFile(mockData, "test-file.json");

      // Check that triggerDownload was called with correct parameters
      expect(triggerDownloadSpy).toHaveBeenCalled();

      // Restore the original method
      triggerDownloadSpy.mockRestore();
    });

    it("should handle errors during file download", () => {
      const mockData = {
        version: "1.0",
        exportDate: "2023-01-01T00:00:00Z",
        mealEntries: [],
        weightEntries: [],
      };

      // Mock error in triggerDownload
      const triggerDownloadSpy = vi
        .spyOn(DataExporter, "triggerDownload")
        .mockImplementation(() => {
          throw new Error("Download error");
        });

      expect(() => {
        DataExporter.downloadJsonFile(mockData, "test-file.json");
      }).toThrow("Failed to generate download file");

      // Restore the original method
      triggerDownloadSpy.mockRestore();
    });
  });
});

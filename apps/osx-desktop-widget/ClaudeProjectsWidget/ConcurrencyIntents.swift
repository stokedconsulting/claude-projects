import AppIntents
import WidgetKit

// Intent to set specific LLM count
struct SetLLMCountIntent: AppIntent {
    static var title: LocalizedStringResource = "Set LLM Count"
    static var description = IntentDescription("Set the number of concurrent LLM processes")
    
    @Parameter(title: "Count")
    var count: Int
    
    init() {
        self.count = 4
    }
    
    init(count: Int) {
        self.count = count
    }
    
    func perform() async throws -> some IntentResult {
        ClaudeProjectsDataSource.shared.updateLLMCount(count)
        WidgetCenter.shared.reloadTimelines(ofKind: "ClaudeProjectsWidget")
        return .result()
    }
}

// Intent to increment LLM count
struct IncrementLLMIntent: AppIntent {
    static var title: LocalizedStringResource = "Increase LLM Count"
    static var description = IntentDescription("Add one more LLM slot")
    
    func perform() async throws -> some IntentResult {
        ClaudeProjectsDataSource.shared.incrementLLMCount()
        WidgetCenter.shared.reloadTimelines(ofKind: "ClaudeProjectsWidget")
        return .result()
    }
}

// Intent to decrement LLM count
struct DecrementLLMIntent: AppIntent {
    static var title: LocalizedStringResource = "Decrease LLM Count"
    static var description = IntentDescription("Remove one LLM slot")
    
    func perform() async throws -> some IntentResult {
        ClaudeProjectsDataSource.shared.decrementLLMCount()
        WidgetCenter.shared.reloadTimelines(ofKind: "ClaudeProjectsWidget")
        return .result()
    }
}

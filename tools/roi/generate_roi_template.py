#!/usr/bin/env python3
"""Generate a Google-Sheets-compatible ROI calculator workbook.

The resulting `.xlsx` file can be uploaded to Google Sheets and published as
the public Project NoeMI ROI calculator template.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from xml.sax.saxutils import escape
import zipfile


OUTPUT_PATH = Path(__file__).with_name("project-noemi-roi-calculator-template.xlsx")
DEFAULT_MONTH = datetime.now(timezone.utc).strftime("%Y-%m")
DEFAULT_DATE = datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass(frozen=True)
class FormulaCell:
    formula: str
    value: str | int | float = ""
    cell_type: str | None = None


def col_letter(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def cell_ref(row_index: int, col_index: int) -> str:
    return f"{col_letter(col_index)}{row_index}"


def inline_string_cell(ref: str, value: str, style_index: int | None = None) -> str:
    style_attr = f' s="{style_index}"' if style_index is not None else ""
    return (
        f'<c r="{ref}" t="inlineStr"{style_attr}>'
        f"<is><t>{escape(value)}</t></is>"
        "</c>"
    )


def numeric_cell(ref: str, value: int | float, style_index: int | None = None) -> str:
    style_attr = f' s="{style_index}"' if style_index is not None else ""
    return f'<c r="{ref}"{style_attr}><v>{value}</v></c>'


def boolean_cell(ref: str, value: bool, style_index: int | None = None) -> str:
    style_attr = f' s="{style_index}"' if style_index is not None else ""
    return f'<c r="{ref}" t="b"{style_attr}><v>{1 if value else 0}</v></c>'


def formula_cell(
    ref: str,
    formula: str,
    value: str | int | float = "",
    cell_type: str | None = None,
    style_index: int | None = None,
) -> str:
    style_attr = f' s="{style_index}"' if style_index is not None else ""
    type_attr = f' t="{cell_type}"' if cell_type else ""
    formula_body = escape(formula[1:] if formula.startswith("=") else formula)
    value_body = escape(str(value))
    return (
        f'<c r="{ref}"{type_attr}{style_attr}>'
        f"<f>{formula_body}</f>"
        f"<v>{value_body}</v>"
        "</c>"
    )


def serialize_cell(ref: str, value: object, style_index: int | None = None) -> str | None:
    if value is None:
        return None
    if isinstance(value, FormulaCell):
        return formula_cell(ref, value.formula, value.value, value.cell_type, style_index)
    if isinstance(value, bool):
        return boolean_cell(ref, value, style_index)
    if isinstance(value, (int, float)):
        return numeric_cell(ref, value, style_index)
    return inline_string_cell(ref, str(value), style_index)


def serialize_rows(rows: list[list[object]], freeze_header: bool = True) -> str:
    row_xml: list[str] = []
    max_col = 1
    max_row = max(1, len(rows))
    for row_index, row in enumerate(rows, start=1):
        cell_xml: list[str] = []
        for col_index, value in enumerate(row, start=1):
            max_col = max(max_col, col_index)
            style_index = 1 if row_index == 1 else None
            rendered = serialize_cell(cell_ref(row_index, col_index), value, style_index)
            if rendered:
                cell_xml.append(rendered)
        row_xml.append(f'<row r="{row_index}">{"".join(cell_xml)}</row>')
    dimension = f"A1:{cell_ref(max_row, max_col)}"
    sheet_view = (
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
        "</sheetView></sheetViews>"
        if freeze_header
        else '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<dimension ref=\"{dimension}\"/>"
        f"{sheet_view}"
        '<sheetFormatPr defaultRowHeight="15"/>'
        f"<sheetData>{''.join(row_xml)}</sheetData>"
        "</worksheet>"
    )


def build_readme_rows() -> list[list[object]]:
    return [
        ["Project NoeMI ROI Calculator Template", "", ""],
        ["Field", "Value", "Notes"],
        ["deployment_name", "Template deployment", "Rename per client or internal program copy."],
        ["client_name", "Template client", "Use example data only in the public template."],
        ["owner", "Program owner", "Set the accountable operator or Accelerator."],
        ["currency", "USD", "Use one currency per workbook copy."],
        ["review_cadence", "Monthly", "Review with operators and executive stakeholders."],
        ["baseline_last_approved_on", DEFAULT_DATE, "Refresh whenever assumptions change."],
        ["generated_on", DEFAULT_DATE, "Workbook artifact generated from repo source."],
        ["", "", ""],
        ["What this workbook measures", "Conservative labor-cost avoidance and net ROI", "Only count validated, explainable executions."],
        ["What this workbook does not measure", "Speculative value claims or unlogged work", "Do not use unverifiable task counts."],
        ["Operating rule", "Evidence first", "Every included execution should have a traceable source and evidence reference."],
        ["Operating rule", "Conservative valuation", "Prefer the lower credible baseline when estimates are uncertain."],
        ["Operating rule", "No PII or secrets", "Execution evidence should never expose credentials or personal data."],
        ["", "", ""],
        ["Template workflow", "1. Approve assumptions and task baselines", "Protect the assumptions, task catalog, and investment tabs."],
        ["Template workflow", "2. Copy the workbook per deployment", "Keep the public template as example-only data."],
        ["Template workflow", "3. Append validated executions to 03_EXECUTION_LOG", "Treat that tab as append-only for automation."],
        ["Template workflow", "4. Review 04_ROI_AUDIT exclusions", "Do not force excluded rows into ROI without human approval."],
        ["Template workflow", "5. Review 06_DASHBOARD monthly", "Track both gross cost avoidance and net ROI."],
        ["", "", ""],
        ["Publishing checklist", "No internal-only pricing or client data", "Keep example rows only in the public template."],
        ["Publishing checklist", "No secrets, credentials, or API references", "This sheet can be shared publicly."],
        ["Publishing checklist", "Protected approval-sensitive tabs", "Apply sheet protections after upload to Google Sheets."],
        ["Publishing checklist", "Ready for 'Make a copy' workflow", "Use the workbook upload to create the public Google Sheets template."],
    ]


def build_assumption_rows() -> list[list[object]]:
    return [
        ["role_id", "human_role", "loaded_hourly_rate", "rate_source", "approved_by", "approved_on", "notes"],
        ["engineering_manager", "Engineering Manager", 120, "Illustrative blended internal rate", "Accelerator lead", DEFAULT_DATE, "Replace with approved deployment rate."],
        ["it_ops_engineer", "IT Operations Engineer", 85, "Illustrative blended internal rate", "Accelerator lead", DEFAULT_DATE, "Replace with approved deployment rate."],
        ["knowledge_worker", "Knowledge Worker", 70, "Illustrative blended internal rate", "Accelerator lead", DEFAULT_DATE, "Replace with approved deployment rate."],
        ["marketing_manager", "Marketing Manager", 75, "Illustrative blended internal rate", "Accelerator lead", DEFAULT_DATE, "Replace with approved deployment rate."],
        ["content_producer", "Content Producer", 65, "Illustrative blended internal rate", "Accelerator lead", DEFAULT_DATE, "Replace with approved deployment rate."],
    ]


def build_task_rows() -> list[list[object]]:
    return [
        ["task_id", "agent_persona", "task_name", "business_function", "human_role_owner", "human_baseline_minutes", "human_review_minutes", "exception_minutes", "evidence_required", "approved_for_roi", "baseline_owner", "baseline_last_reviewed"],
        ["gatekeeper_pr_triage", "engineering/gatekeeper", "Triage pull request risk", "engineering", "engineering_manager", 20, 5, 2, "Structured PR report plus trace_id", True, "Accelerator lead", DEFAULT_DATE],
        ["knowledge_manager_internal_answer", "operations/knowledge-manager", "Answer internal policy question", "operations", "knowledge_worker", 15, 4, 1, "Knowledge answer output plus source refs", True, "Accelerator lead", DEFAULT_DATE],
        ["linux_daily_health_check", "infrastructure/linux", "Run daily health check and summarize", "operations", "it_ops_engineer", 25, 5, 2, "Health summary plus host trace", True, "Accelerator lead", DEFAULT_DATE],
        ["seo_metadata_generation", "marketing/seo-strategist", "Draft SEO metadata package", "marketing", "marketing_manager", 30, 8, 3, "Metadata package plus campaign trace", True, "Accelerator lead", DEFAULT_DATE],
        ["video_content_packaging", "marketing/video-content-manager", "Package rough cut into publishable asset set", "marketing", "content_producer", 45, 12, 5, "Packaging output plus content trace", True, "Accelerator lead", DEFAULT_DATE],
    ]


def build_execution_rows() -> list[list[object]]:
    return [
        ["execution_id", "timestamp_utc", "tenant_id", "agent_persona", "task_id", "status", "trace_id", "quantity", "review_required", "evidence_ref", "source_system", "notes"],
        ["sample-exec-001", f"{DEFAULT_MONTH}-01T09:15:00Z", "tenant-template", "engineering/gatekeeper", "gatekeeper_pr_triage", "success", "trace-001", 1, False, "github:pr/123", "github", "Example execution row"],
        ["sample-exec-002", f"{DEFAULT_MONTH}-03T11:00:00Z", "tenant-template", "operations/knowledge-manager", "knowledge_manager_internal_answer", "success", "trace-002", 3, False, "docs:policy/remote-work", "n8n", "Example execution row"],
        ["sample-exec-003", f"{DEFAULT_MONTH}-05T07:30:00Z", "tenant-template", "infrastructure/linux", "linux_daily_health_check", "success", "trace-003", 1, False, "loki:health-check/445", "loki", "Example execution row"],
        ["sample-exec-004", f"{DEFAULT_MONTH}-06T14:20:00Z", "tenant-template", "marketing/seo-strategist", "seo_metadata_generation", "success", "trace-004", 2, True, "drive:seo-brief/2026-04", "google-drive", "Example execution row"],
        ["sample-exec-005", f"{DEFAULT_MONTH}-08T16:45:00Z", "tenant-template", "marketing/video-content-manager", "video_content_packaging", "failed", "trace-005", 1, True, "drive:video-job/2026-04", "n8n", "Failed example row should be excluded"],
    ]


def roi_formula_rows(limit: int = 250) -> list[list[object]]:
    rows: list[list[object]] = [[
        "execution_id",
        "month",
        "task_id",
        "human_role_owner",
        "baseline_minutes",
        "review_minutes",
        "exception_minutes",
        "net_minutes_saved",
        "hours_saved",
        "hourly_rate",
        "gross_cost_avoidance",
        "included_in_roi",
        "exclusion_reason",
        "confidence_band",
        "can_this_be_explained_to_a_cfo",
    ]]
    for row_index in range(2, limit + 2):
        task_match = f"MATCH(C{row_index},'02_TASK_CATALOG'!A:A,0)"
        role_match = f"MATCH(D{row_index},'01_ASSUMPTIONS'!A:A,0)"
        quantity_expr = f"IF('03_EXECUTION_LOG'!H{row_index}=\"\",1,'03_EXECUTION_LOG'!H{row_index})"
        approved_expr = f"INDEX('02_TASK_CATALOG'!J:J,{task_match})"
        rows.append([
            FormulaCell(f'=IF(\'03_EXECUTION_LOG\'!A{row_index}="","",\'03_EXECUTION_LOG\'!A{row_index})', "", "str"),
            FormulaCell(f"=IF('03_EXECUTION_LOG'!B{row_index}=\"\",\"\",LEFT('03_EXECUTION_LOG'!B{row_index},7))", "", "str"),
            FormulaCell(f'=IF(\'03_EXECUTION_LOG\'!E{row_index}="","",\'03_EXECUTION_LOG\'!E{row_index})', "", "str"),
            FormulaCell(f"=IF(C{row_index}=\"\",\"\",INDEX('02_TASK_CATALOG'!E:E,{task_match}))", "", "str"),
            FormulaCell(f"=IF(C{row_index}=\"\",\"\",INDEX('02_TASK_CATALOG'!F:F,{task_match}))", 0),
            FormulaCell(f"=IF(C{row_index}=\"\",\"\",INDEX('02_TASK_CATALOG'!G:G,{task_match}))", 0),
            FormulaCell(f"=IF(C{row_index}=\"\",\"\",INDEX('02_TASK_CATALOG'!H:H,{task_match}))", 0),
            FormulaCell(f"=IF(A{row_index}=\"\",\"\",MAX(0,E{row_index}-F{row_index}-G{row_index}))", 0),
            FormulaCell(f"=IF(A{row_index}=\"\",\"\",H{row_index}*{quantity_expr}/60)", 0),
            FormulaCell(f"=IF(D{row_index}=\"\",\"\",INDEX('01_ASSUMPTIONS'!C:C,{role_match}))", 0),
            FormulaCell(f"=IF(OR(A{row_index}=\"\",L{row_index}<>TRUE),0,I{row_index}*J{row_index})", 0),
            FormulaCell(
                f'=IF(A{row_index}="","",AND(\'03_EXECUTION_LOG\'!F{row_index}="success",{approved_expr}=TRUE,H{row_index}>0,J{row_index}>0,\'03_EXECUTION_LOG\'!J{row_index}<>""))',
                0,
                "b",
            ),
            FormulaCell(
                f'=IF(A{row_index}="","",IF(\'03_EXECUTION_LOG\'!F{row_index}<>"success","non-success status",IF({approved_expr}<>TRUE,"task not approved",IF(H{row_index}<=0,"no net time saved",IF(J{row_index}<=0,"missing labor rate",IF(\'03_EXECUTION_LOG\'!J{row_index}="","missing evidence",""))))))',
                "",
                "str",
            ),
            FormulaCell(
                f'=IF(A{row_index}="","",IF(AND(L{row_index}=TRUE,\'03_EXECUTION_LOG\'!I{row_index}=FALSE),"high",IF(AND(L{row_index}=TRUE,\'03_EXECUTION_LOG\'!I{row_index}=TRUE),"medium","low")))',
                "",
                "str",
            ),
            FormulaCell(
                f'=IF(A{row_index}="","",IF(AND(L{row_index}=TRUE,\'03_EXECUTION_LOG\'!J{row_index}<>""),"yes","needs-review"))',
                "",
                "str",
            ),
        ])
    return rows


def build_investment_rows() -> list[list[object]]:
    return [
        ["cost_id", "category", "cost_type", "description", "billing_frequency", "monthly_cost", "one_time_cost", "owner", "notes"],
        ["platform_infisical", "platform", "recurring", "SecretOps platform subscription", "monthly", 250, 0, "Ops lead", "Illustrative example row"],
        ["orchestrator_hosting", "platform", "recurring", "Container and orchestration hosting", "monthly", 300, 0, "Ops lead", "Illustrative example row"],
        ["rollout_enablement", "implementation", "one-time", "Initial workflow implementation and setup", "one-time", 0, 4500, "Program lead", "Illustrative example row"],
        ["managed_service_support", "managed_service", "recurring", "Ongoing operator tuning and support", "monthly", 1200, 0, "Service owner", "Illustrative example row"],
        ["training_enablement", "training", "one-time", "Governance and team enablement", "one-time", 0, 1500, "Learning owner", "Illustrative example row"],
    ]


def build_dashboard_rows() -> list[list[object]]:
    return [
        ["Metric", "Value", "Notes"],
        ["selected_month", DEFAULT_MONTH, "Update this to review a different month."],
        ["validated_executions", FormulaCell("=COUNTIFS('04_ROI_AUDIT'!L:L,TRUE,'04_ROI_AUDIT'!B:B,B2)", 0), "Included rows for the selected month."],
        ["hours_saved_mtd", FormulaCell("=SUMIFS('04_ROI_AUDIT'!I:I,'04_ROI_AUDIT'!B:B,B2,'04_ROI_AUDIT'!L:L,TRUE)", 0), "Hours saved for included rows in the selected month."],
        ["gross_cost_avoidance_mtd", FormulaCell("=SUMIFS('04_ROI_AUDIT'!K:K,'04_ROI_AUDIT'!B:B,B2,'04_ROI_AUDIT'!L:L,TRUE)", 0), "Gross labor-cost avoidance for the selected month."],
        ["operating_cost_mtd", FormulaCell("=SUM('05_INVESTMENT'!F:F)", 0), "Recurring monthly operating cost."],
        ["one_time_cost_total", FormulaCell("=SUM('05_INVESTMENT'!G:G)", 0), "One-time implementation and enablement cost."],
        ["net_benefit_mtd", FormulaCell("=B5-B6", 0), "Gross cost avoidance minus monthly operating cost."],
        ["annualized_net_benefit", FormulaCell("=B8*12", 0), "Simple annualization of the current month net benefit."],
        ["roi_percent", FormulaCell('=IF((B6*12+B7)=0,"",(B5*12-(B6*12+B7))/(B6*12+B7))', 0), "Net ROI after recurring and one-time cost."],
        ["payback_months", FormulaCell('=IF(B8<=0,"",B7/B8)', "", "str"), "Months required to recover one-time investment."],
        ["top_agent_note", "Build a pivot table from 04_ROI_AUDIT grouped by task_id or agent_persona", "Charts are best added after upload to Google Sheets."],
        ["excluded_rows", FormulaCell("=COUNTIF('04_ROI_AUDIT'!L:L,FALSE)", 0), "Rows excluded from ROI due to missing evidence, failed status, or missing baseline support."],
    ]


def content_types_xml(sheet_count: int) -> str:
    sheet_overrides = "".join(
        f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        for index in range(1, sheet_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '<Override PartName="/docProps/core.xml" '
        'ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        f"{sheet_overrides}"
        "</Types>"
    )


def rels_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" '
        'Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" '
        'Target="docProps/app.xml"/>'
        "</Relationships>"
    )


def app_xml(sheet_names: Iterable[str]) -> str:
    parts = "".join(f"<vt:lpstr>{escape(name)}</vt:lpstr>" for name in sheet_names)
    count = len(sheet_names)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        "<Application>Codex</Application>"
        "<DocSecurity>0</DocSecurity>"
        "<ScaleCrop>false</ScaleCrop>"
        "<HeadingPairs><vt:vector size=\"2\" baseType=\"variant\">"
        "<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>"
        f"<vt:variant><vt:i4>{count}</vt:i4></vt:variant>"
        "</vt:vector></HeadingPairs>"
        f"<TitlesOfParts><vt:vector size=\"{count}\" baseType=\"lpstr\">{parts}</vt:vector></TitlesOfParts>"
        "<Company>Project NoeMI</Company>"
        "<LinksUpToDate>false</LinksUpToDate>"
        "<SharedDoc>false</SharedDoc>"
        "<HyperlinksChanged>false</HyperlinksChanged>"
        "<AppVersion>16.0300</AppVersion>"
        "</Properties>"
    )


def core_xml() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        "<dc:creator>Codex</dc:creator>"
        "<cp:lastModifiedBy>Codex</cp:lastModifiedBy>"
        "<dc:title>Project NoeMI ROI Calculator Template</dc:title>"
        "<dc:description>Google Sheets compatible ROI calculator workbook for Project NoeMI.</dc:description>"
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{timestamp}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{timestamp}</dcterms:modified>'
        "</cp:coreProperties>"
    )


def workbook_xml(sheet_names: list[str]) -> str:
    sheets = "".join(
        f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
        for index, name in enumerate(sheet_names, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<fileVersion appName="Codex"/>'
        "<workbookPr defaultThemeVersion=\"166925\"/>"
        "<bookViews><workbookView xWindow=\"0\" yWindow=\"0\" windowWidth=\"19200\" windowHeight=\"10800\"/></bookViews>"
        f"<sheets>{sheets}</sheets>"
        "</workbook>"
    )


def workbook_rels_xml(sheet_count: int) -> str:
    sheet_rels = "".join(
        f'<Relationship Id="rId{index}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        f'Target="worksheets/sheet{index}.xml"/>'
        for index in range(1, sheet_count + 1)
    )
    styles_id = sheet_count + 1
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f"{sheet_rels}"
        f'<Relationship Id="rId{styles_id}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
        "</Relationships>"
    )


def styles_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2">'
        '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>'
        '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>'
        "</fonts>"
        '<fills count="2">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        "</fills>"
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="2">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">'
        '<alignment horizontal="center" vertical="center" wrapText="1"/>'
        "</xf>"
        "</cellXfs>"
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        "</styleSheet>"
    )


def build_workbook() -> None:
    sheets = [
        ("00_README", build_readme_rows(), False),
        ("01_ASSUMPTIONS", build_assumption_rows(), True),
        ("02_TASK_CATALOG", build_task_rows(), True),
        ("03_EXECUTION_LOG", build_execution_rows(), True),
        ("04_ROI_AUDIT", roi_formula_rows(), True),
        ("05_INVESTMENT", build_investment_rows(), True),
        ("06_DASHBOARD", build_dashboard_rows(), True),
    ]
    sheet_names = [name for name, _, _ in sheets]

    with zipfile.ZipFile(OUTPUT_PATH, "w", compression=zipfile.ZIP_DEFLATED) as workbook:
        workbook.writestr("[Content_Types].xml", content_types_xml(len(sheets)))
        workbook.writestr("_rels/.rels", rels_xml())
        workbook.writestr("docProps/app.xml", app_xml(sheet_names))
        workbook.writestr("docProps/core.xml", core_xml())
        workbook.writestr("xl/workbook.xml", workbook_xml(sheet_names))
        workbook.writestr("xl/_rels/workbook.xml.rels", workbook_rels_xml(len(sheets)))
        workbook.writestr("xl/styles.xml", styles_xml())
        for index, (_, rows, freeze_header) in enumerate(sheets, start=1):
            workbook.writestr(
                f"xl/worksheets/sheet{index}.xml",
                serialize_rows(rows, freeze_header=freeze_header),
            )


if __name__ == "__main__":
    build_workbook()
    print(f"Generated {OUTPUT_PATH}")

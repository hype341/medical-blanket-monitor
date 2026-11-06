from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "medical-blanket-one-click-deploy.pdf"
FONT_REGULAR = Path(r"C:\Windows\Fonts\Deng.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\Dengb.ttf")

GREEN = colors.HexColor("#1E6F5C")
DARK = colors.HexColor("#183B36")
MUTED = colors.HexColor("#667D77")
BG = colors.HexColor("#F2F8F5")
LINE = colors.HexColor("#D7E5DF")
WHITE = colors.white


def register_fonts():
    pdfmetrics.registerFont(TTFont("Deng", str(FONT_REGULAR)))
    pdfmetrics.registerFont(TTFont("DengBold", str(FONT_BOLD)))


def make_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            fontName="DengBold",
            fontSize=28,
            leading=38,
            textColor=DARK,
            alignment=TA_LEFT,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            fontName="Deng",
            fontSize=11,
            leading=19,
            textColor=MUTED,
            spaceAfter=14,
        ),
        "h1": ParagraphStyle(
            "H1",
            fontName="DengBold",
            fontSize=17,
            leading=24,
            textColor=DARK,
            spaceBefore=12,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "H2",
            fontName="DengBold",
            fontSize=12,
            leading=18,
            textColor=GREEN,
            spaceBefore=8,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "Body",
            fontName="Deng",
            fontSize=9.5,
            leading=16,
            textColor=DARK,
            spaceAfter=6,
        ),
        "small": ParagraphStyle(
            "Small",
            fontName="Deng",
            fontSize=8,
            leading=12,
            textColor=MUTED,
        ),
        "code": ParagraphStyle(
            "Code",
            fontName="Deng",
            fontSize=8.5,
            leading=13,
            textColor=DARK,
            leftIndent=7,
            rightIndent=7,
        ),
        "cover_kicker": ParagraphStyle(
            "CoverKicker",
            fontName="DengBold",
            fontSize=10,
            leading=15,
            textColor=GREEN,
            spaceAfter=12,
        ),
        "cover_center": ParagraphStyle(
            "CoverCenter",
            fontName="Deng",
            fontSize=10,
            leading=16,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }


def code_box(text, styles):
    table = Table([[Paragraph(text.replace("\n", "<br/>"), styles["code"])]], colWidths=[168 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def config_table(styles):
    rows = [
        ("GitHub 仓库", "https://github.com/hype341/medical-blanket-monitor"),
        ("本地目录", r"D:\codex\blanket"),
        ("服务器", "h@192.168.86.128"),
        ("网站", "http://192.168.86.128/"),
        ("网站目录", "/var/www/blanket"),
        ("部署私钥", r"%USERPROFILE%\.ssh\blanket_deploy_ed25519"),
        ("服务器发布命令", "/usr/local/bin/blanket-deploy"),
        ("自动备份目录", "/var/backups/blanket"),
    ]
    data = [
        [
            Paragraph("<b>项目</b>", styles["body"]),
            Paragraph("<b>当前配置</b>", styles["body"]),
        ]
    ]
    for key, value in rows:
        data.append([Paragraph(key, styles["body"]), Paragraph(value, styles["small"])])
    table = Table(data, colWidths=[42 * mm, 126 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), GREEN),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
                ("BACKGROUND", (0, 1), (-1, -1), WHITE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BG]),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def build_pdf():
    register_fonts()
    styles = make_styles()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=21 * mm,
        leftMargin=21 * mm,
        topMargin=23 * mm,
        bottomMargin=20 * mm,
        title="医用智能毯平台一键部署说明",
        author="Codex",
    )

    def page(canvas, document):
        canvas.saveState()
        canvas.setFillColor(GREEN)
        canvas.rect(0, A4[1] - 7 * mm, A4[0], 7 * mm, fill=1, stroke=0)
        canvas.setFillColor(MUTED)
        canvas.setFont("Deng", 7.5)
        canvas.drawString(21 * mm, 10 * mm, "医用智能毯平台 · 一键部署说明")
        canvas.drawRightString(A4[0] - 21 * mm, 10 * mm, f"第 {document.page} 页")
        canvas.restoreState()

    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="main",
    )
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=page)])

    story = [
        Spacer(1, 16 * mm),
        Paragraph("DEPLOYMENT RUNBOOK", styles["cover_kicker"]),
        Paragraph("医用智能毯平台<br/>一键部署说明", styles["title"]),
        Paragraph(
            "适用于当前本地服务器、GitHub 主分支和 Nginx 生产部署。"
            "一条命令完成类型检查、构建、上传、备份、校验与重载。",
            styles["subtitle"],
        ),
        Spacer(1, 5 * mm),
        config_table(styles),
        Spacer(1, 9 * mm),
        code_box(".\\deploy.cmd", styles),
        Spacer(1, 7 * mm),
        Paragraph(
            "当前部署已完成：GitHub 已推送、专用部署密钥已安装、服务器发布命令已配置、"
            "部署前自动备份已启用。",
            styles["body"],
        ),
        Spacer(1, 32 * mm),
        Paragraph("生成日期：2026-11-06 · Asia/Shanghai", styles["cover_center"]),
    ]

    story += [
        Paragraph("日常部署", styles["h1"]),
        Paragraph(
            "在 D:\\codex\\blanket 目录双击 deploy.cmd，或执行以下命令：",
            styles["body"],
        ),
        code_box(".\\deploy.cmd", styles),
        Spacer(1, 4 * mm),
        Paragraph("一键脚本执行的八步", styles["h2"]),
        Paragraph(
            "1. TypeScript 类型检查。<br/>"
            "2. Vite 生产构建。<br/>"
            "3. 使用专用 SSH 密钥上传 dist。<br/>"
            "4. 在服务器生成部署前备份。<br/>"
            "5. 复制新版网站文件并修正 www-data 权限。<br/>"
            "6. 执行 nginx -t。<br/>"
            "7. 校验失败时自动恢复备份。<br/>"
            "8. 校验成功后平滑重载 Nginx。",
            styles["body"],
        ),
        Paragraph("可选参数", styles["h1"]),
        code_box(
            "# 不重新构建，只上传现有 dist\n"
            ".\\deploy.cmd -SkipBuild\n\n"
            "# 部署到同结构服务器\n"
            ".\\deploy.cmd `\n"
            "  -ServerHost 192.168.86.200 -ServerUser h `\n"
            "  -KeyPath \"$env:USERPROFILE\\.ssh\\blanket_deploy_ed25519\"",
            styles,
        ),
        Paragraph("安全配置", styles["h1"]),
        Paragraph(
            "部署私钥保存在本机 %USERPROFILE%\\.ssh，未进入 Git。"
            "服务器只授权 h 用户免密执行 /usr/local/bin/blanket-deploy，"
            "不开放通用 sudo 权限。GitHub 仓库不包含服务器密码。",
            styles["body"],
        ),
        Paragraph("备份与自动回滚", styles["h1"]),
        Paragraph(
            "每次发布前创建 /var/backups/blanket/website-YYYYMMDD-HHMMSS.tar.gz，"
            "最多保留 10 份。Nginx 校验失败时会自动解压本次备份并重载旧版。",
            styles["body"],
        ),
        code_box(
            "# 人工回滚示例\n"
            "sudo tar -C /var/www/blanket -xzf /var/backups/blanket/website-时间.tar.gz\n"
            "sudo chown -R www-data:www-data /var/www/blanket\n"
            "sudo nginx -t\n"
            "sudo systemctl reload nginx",
            styles,
        ),
        PageBreak(),
        Paragraph("更换服务器时补充什么", styles["h1"]),
        Paragraph(
            "1. 将 blanket_deploy_ed25519.pub 加入目标服务器用户的 authorized_keys。<br/>"
            "2. 上传 deploy/server/blanket-deploy 并安装到 /usr/local/bin。<br/>"
            "3. 创建只授权 blanket-deploy 的 sudoers 文件。<br/>"
            "4. 确认 /var/www/blanket、/var/backups/blanket 和 Nginx 服务存在。<br/>"
            "5. 在本机保留对应私钥，并通过 -KeyPath 指向它。",
            styles["body"],
        ),
        code_box(
            "sudo install -o root -g root -m 755 /tmp/blanket-deploy /usr/local/bin/blanket-deploy\n\n"
            "# /etc/sudoers.d/blanket-deploy\n"
            "h ALL=(root) NOPASSWD: /usr/local/bin/blanket-deploy\n\n"
            "sudo visudo -cf /etc/sudoers.d/blanket-deploy",
            styles,
        ),
        Paragraph("常见故障", styles["h1"]),
        Paragraph(
            "<b>缺少部署密钥</b>：确认私钥路径，或使用 -KeyPath 指定。<br/><br/>"
            "<b>Permission denied</b>：目标服务器 authorized_keys 中缺少公钥。<br/><br/>"
            "<b>sudo 要求密码</b>：检查 /etc/sudoers.d/blanket-deploy。<br/><br/>"
            "<b>类型检查或构建失败</b>：脚本在构建阶段停止，线上版本不变。<br/><br/>"
            "<b>Nginx 校验失败</b>：服务器自动恢复备份并重新加载旧版。",
            styles["body"],
        ),
        KeepTogether(
            [
                Paragraph("部署后检查", styles["h1"]),
                code_box(
                    "Invoke-WebRequest http://192.168.86.128/\n"
                    "Invoke-RestMethod http://192.168.86.128/api/health",
                    styles,
                ),
                Spacer(1, 4 * mm),
                Paragraph(
                    "网页应返回 HTTP 200，后端健康状态应为 UP，MQTT 应显示 connected。",
                    styles["body"],
                ),
            ]
        ),
    ]

    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build_pdf()

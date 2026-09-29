"""Generate the Assignment 3 report from recorded evidence. Optional Python tooling."""
from pathlib import Path
import json, statistics, datetime, html
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image, KeepTogether, Preformatted
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon

ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'evidence'
B=json.loads((E/'benchmark-results.json').read_text())
T=json.loads((E/'test-summary.json').read_text())
D=json.loads((E/'demonstration.json').read_text())
W=B['workflow']; OP=W['operations']; ENV=B['environment']; GAS=B['gas']; DEP=W['deployment']
OUT=ROOT/'docs'/'Assignment_3_Report.pdf'
TMP=ROOT/'tmp'/'report';TMP.mkdir(parents=True,exist_ok=True)
FONT=Path('/usr/share/fonts/truetype/dejavu')
pdfmetrics.registerFont(TTFont('DejaVu',str(FONT/'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DejaVuBold',str(FONT/'DejaVuSans-Bold.ttf')))
pdfmetrics.registerFont(TTFont('DejaVuMono',str(FONT/'DejaVuSansMono.ttf')))
pdfmetrics.registerFontFamily('DejaVu',normal='DejaVu',bold='DejaVuBold',italic='DejaVu',boldItalic='DejaVuBold')
NAVY=colors.HexColor('#112735');BLUE=colors.HexColor('#007E70');GRAY=colors.HexColor('#5F6E81');LINE=colors.HexColor('#DCE3ED');PALE=colors.HexColor('#F1F5FA');GOLD=colors.HexColor('#D3A745')
WIDTH=507
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyCustom',fontName='DejaVu',fontSize=9.2,leading=13.7,spaceAfter=9,textColor=NAVY))
styles.add(ParagraphStyle(name='SmallCustom',parent=styles['BodyCustom'],fontSize=8,leading=11.5,spaceAfter=7,textColor=GRAY))
styles.add(ParagraphStyle(name='H1Custom',fontName='DejaVuBold',fontSize=21,leading=26,spaceAfter=15,textColor=NAVY))
styles.add(ParagraphStyle(name='H2Custom',fontName='DejaVuBold',fontSize=11.4,leading=16,spaceBefore=9,spaceAfter=6,textColor=BLUE))
styles.add(ParagraphStyle(name='EyebrowCustom',fontName='DejaVuBold',fontSize=8,leading=12,spaceAfter=8,textColor=GRAY))
styles.add(ParagraphStyle(name='TableCustom',fontName='DejaVu',fontSize=8.2,leading=11.5,textColor=NAVY,wordWrap='CJK'))
styles.add(ParagraphStyle(name='TableHeadCustom',parent=styles['TableCustom'],fontName='DejaVuBold',textColor=colors.white))
styles.add(ParagraphStyle(name='CodeCustom',fontName='DejaVuMono',fontSize=7.3,leading=10.5,spaceAfter=10,textColor=NAVY,backColor=PALE,borderPadding=10))
styles.add(ParagraphStyle(name='CoverTitle',fontName='DejaVuBold',fontSize=31,leading=38,textColor=NAVY,spaceAfter=16))
story=[]
def p(text,style='BodyCustom'): return Paragraph(text,styles[style])
def add(text,style='BodyCustom'): story.append(p(text,style))
def h(text): add(text,'H2Custom')
def page(k,title):
    if story:story.append(PageBreak())
    add(f'ASSIGNMENT 3  /  {k:02d}','EyebrowCustom');add(title,'H1Custom')
def table(headers,rows,widths=None):
    values=[[p(html.escape(str(c)),'TableHeadCustom') for c in headers]]+[[p(html.escape(str(c)),'TableCustom') for c in row] for row in rows]
    item=Table(values,colWidths=widths or [WIDTH/len(headers)]*len(headers),repeatRows=1,hAlign='LEFT')
    item.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),NAVY),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,PALE]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),.6,NAVY),('LINEBELOW',(0,1),(-1,-1),.3,LINE)]))
    story.append(item);story.append(Spacer(1,9))
def callout(title,text):
    item=Table([[p(title,'H2Custom')],[p(text)]],colWidths=[WIDTH])
    item.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PALE),('LINEBEFORE',(0,0),(-1,-1),3,GOLD),('LEFTPADDING',(0,0),(-1,-1),13),('RIGHTPADDING',(0,0),(-1,-1),13),('TOPPADDING',(0,0),(-1,0),6),('BOTTOMPADDING',(0,-1),(-1,-1),9)]))
    story.append(item);story.append(Spacer(1,12))
def fmt(value,digits=2):return f'{value:,.{digits}f}'
def group(n,c):return [s for s in B['scenarios'] if s['volume']==n and s['concurrency']==c]
def mean(n,c,key='tps'):return statistics.mean(s[key] for s in group(n,c))
def architecture():
    d=Drawing(WIDTH,240)
    def box(x,y,w,height,title,detail):
        d.add(Rect(x,y,w,height,rx=5,ry=5,fillColor=PALE,strokeColor=LINE));d.add(String(x+w/2,y+height/2+4,title,fontName='DejaVuBold',fontSize=9,fillColor=NAVY,textAnchor='middle'));d.add(String(x+w/2,y+height/2-10,detail,fontName='DejaVu',fontSize=7.5,fillColor=GRAY,textAnchor='middle'))
    def arrow(x,y1,y2):
        d.add(Line(x,y1,x,y2,strokeColor=BLUE,strokeWidth=1.2));d.add(Polygon([x-3,y2+6,x+3,y2+6,x,y2],fillColor=BLUE,strokeColor=BLUE))
    box(0,193,317,45,'Customer wallet + browser DApp','Register | open account | deposit | withdraw | transfer')
    box(333,193,174,45,'Administrator','Freeze / unfreeze | pause / resume')
    arrow(158,193,167);arrow(420,193,167)
    box(0,121,507,46,'Local Express service and JSON-RPC','Interface | consistent balance reads | event history | verifiable receipts')
    arrow(253,121,96)
    box(0,51,507,45,'LedgerBank smart contract on Ganache EVM','Wallet authorization | integer accounting | unique requests | reentrancy guard')
    arrow(126,51,29);arrow(380,51,29)
    box(0,-17,252,46,'Account ledger + immutable events','Customer balances and total liabilities')
    box(269,-17,238,46,'Native ETH vault','Actual assets backing customer balances')
    return d
def resource_mean(n,c,key):return statistics.mean(s['resources'][key] for s in group(n,c))
def charts():
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,'axes.spines.top':False,'axes.spines.right':False,'axes.labelcolor':'#18313d','text.color':'#18313d','xtick.color':'#637783','ytick.color':'#637783'})
    fig,ax=plt.subplots(figsize=(7.2,2.7));labels=['Deposit','Withdrawal','Transfer'];keys=['deposit','withdrawal','transfer'];xs=list(range(3))
    ax.bar([x-.19 for x in xs],[OP[k]['transactionMs']['mean'] for k in keys],width=.36,label='Mean',color='#007e70');ax.bar([x+.19 for x in xs],[OP[k]['transactionMs']['p95'] for k in keys],width=.36,label='95th percentile',color='#8bc7bd');ax.set_xticks(xs,labels);ax.set_ylabel('Submission to receipt (ms)');ax.grid(axis='y',alpha=.18);ax.set_axisbelow(True);ax.legend(frameon=False);fig.tight_layout();fig.savefig(TMP/'latency.png',dpi=200);plt.close(fig)
    fig,axes=plt.subplots(1,2,figsize=(7.2,2.8))
    for ax,conditions,title,label in [(axes[0],[(30,4),(60,4),(120,4)],'Transaction volume (C = 4)','Transactions per run'),(axes[1],[(120,1),(120,4),(120,8)],'Concurrency (N = 120)','Concurrent customers')]:
        xs=[n if label.startswith('Transactions') else c for n,c in conditions];ys=[mean(n,c) for n,c in conditions];errs=[statistics.stdev(s['tps'] for s in group(n,c)) for n,c in conditions]
        ax.errorbar(xs,ys,yerr=errs,fmt='o-',color='#007e70',capsize=4,linewidth=2);ax.set_title(title,fontsize=10);ax.set_xlabel(label);ax.set_ylabel('Successful transactions / second');ax.set_xticks(xs);ax.set_ylim(0,max(ys)*1.25);ax.grid(alpha=.18)
        for x,y in zip(xs,ys):ax.annotate(f'{y:.2f}',(x,y),xytext=(0,8),textcoords='offset points',ha='center',fontsize=8)
    fig.tight_layout();fig.savefig(TMP/'scalability.png',dpi=200);plt.close(fig)
    fig,axes=plt.subplots(1,2,figsize=(7.2,2.65));conditions=[(30,4),(60,4),(120,4),(120,1),(120,8)];labels=['30/4','60/4','120/4','120/1','120/8']
    for ax,key,title,ylabel,color in [(axes[0],'cpuPercentOneCore','Process CPU during load','Percent of one CPU core','#007e70'),(axes[1],'sampledPeakRssMiB','Maximum reported RSS','MiB','#43708a')]:
        values=[resource_mean(n,c,key) for n,c in conditions];ax.bar(range(5),values,color=color,width=.65);ax.set_xticks(range(5),labels);ax.set_xlabel('Transactions / concurrent customers');ax.set_ylabel(ylabel);ax.set_title(title,fontsize=10);ax.grid(axis='y',alpha=.18);ax.set_axisbelow(True);ax.set_ylim(0,max(values)*1.25)
        for i,y in enumerate(values):ax.text(i,y+max(values)*.035,f'{y:.1f}',ha='center',fontsize=8)
    fig.tight_layout();fig.savefig(TMP/'resources.png',dpi=200);plt.close(fig)
charts()
TOTAL=sum(s['volume'] for s in B['scenarios']);SUCCEEDED=sum(s['successes'] for s in B['scenarios'])

# 1
page(1,'')
add('LedgerBank','CoverTitle')
add('Blockchain-Based Secure<br/>Banking Transaction System','H1Custom')
add('MSc Blockchain Course  |  Assignment 3','EyebrowCustom');story.append(Spacer(1,16))
table(['Student details','Complete before submission'],[['Name','________________________________'],['Student / registration ID','________________________________'],['Programme / institution','________________________________'],['Evaluation date',B['finishedAt'][:10]]],[165,342])
h('Abstract')
add('LedgerBank is a working blockchain banking prototype for customer registration, account creation, deposits, withdrawals, internal transfers and immutable transaction history. A Solidity contract holds local test ETH and maintains exact customer balances. It produces verifiable events and receipts while enforcing account ownership, available-balance checks, request uniqueness and withdrawal reentrancy protection.')
add('The project includes a browser workspace, balance inquiry, administrator freeze/pause controls, printable and JSON transaction receipts, a direct-RPC receipt verifier and a persistent local EVM. Evaluation executes real transactions, checks accounting invariants, tests malicious withdrawal receivers and measures costs, latency, throughput, CPU and memory under repeated transaction loads.')
table(['Verified outcome','Observed result'],[[f'{T["passed"]} automated tests','All passed, including security, accounting and restart'],['Mixed transaction loads',f'{SUCCEEDED:,} / {TOTAL:,} successful operations across 15 runs'],['Mean transfer latency',f'{fmt(OP["transfer"]["transactionMs"]["mean"])} ms from submission to receipt'],['Mean transaction fee',f'{B["averageFinancialTransactionFeeEth"]["mean"]:.9f} synthetic ETH']],[202,305])
add('Scope: actual local contract execution using synthetic ETH on Ganache. This is not a fiat banking integration, independently validated public network, production security certification or financial product. The deliverables are the project ZIP and this 14-page report; the video is excluded as requested.','SmallCustom')

# 2
page(2,'Problem, objectives and requirement coverage')
add('The assignment identifies tampering, slow verification, limited visibility and reliance on a central database as problems in transaction recording [1]. LedgerBank makes transaction rules explicit in a smart contract and derives balances, history and receipts from its ledger. Its local deployment demonstrates implementation and measurable execution; decentralization across independent operators remains a deployment concern.')
h('Minimum functions and requested behavior')
table(['Requirement','Delivered implementation','Evidence'],[['Customer registration','Wallet-controlled salted identity commitment','Tests 02-03, 06'],['Account creation','Separate numbered account; zero opening balance','Tests 04-06'],['Deposit','Payable ETH credited exactly to the depositor','Tests 07, 09-10'],['Withdrawal','Actual payout; accounting rollback on payment failure','Tests 11, 24-25'],['Money transfer','Atomic transfer between active customer accounts','Tests 12-17'],['Transaction history','Sequenced immutable events; customer filtering','Test 30'],['Balance inquiry','Bank and external-wallet balances at a reported block','Test 30'],['Administrator dashboard','Backing, totals, freeze/pause and event audit','Tests 18-21, 32'],['Secure management and receipts','Ownership, retry IDs, exact receipt reconstruction','Tests 15, 24-31; CLI']],[117,277,113])
h('Required evaluation and submission')
table(['Assignment item','Report / reproducible evidence'],[['Deployment cost, average transaction cost, gas','Actual mined receipts and operation tables, p. 10'],['Deposit / withdrawal / transfer latency','20 measured trials per operation, p. 11'],['Block confirmation time','Precisely defined receipt intervals, pp. 9 and 11'],['TPS and different transaction loads','15 balanced mixed-operation runs, p. 12'],['CPU and memory','Fresh-process measurements and resource scope, p. 13'],['Report <=15 pages','This 14-page report; source and evidence in ZIP'],['10-minute video','Explicitly excluded by the user\'s instruction']],[218,289])

# 3
page(3,'System architecture and trust boundaries')
story.append(architecture());story.append(Spacer(1,28))
add('<b>Figure 1.</b> Local application architecture. Native ETH custody and account liabilities are separate on-chain quantities. The independent receipt CLI can query a trusted RPC without using the application\'s receipt endpoint.','SmallCustom')
h('Component responsibilities')
add('The browser offers a working banking interface, customer enrollment, payment forms, history and receipts. The demo selector represents several test users; an optional browser wallet can sign with its own account. The UI stores only unresolved request metadata locally so interrupted submissions can be checked without inventing a replacement payment.')
add('Express serves the interface and exposes read APIs plus a restricted same-origin JSON-RPC proxy. The contract enforces all write permissions and accounting rules. The same local process hosts Ganache, while chain data and the deployment record persist under data/. Read APIs derive their results from chain state rather than an independently editable balance database.')
h('Trust and deployment model')
add('Customers trust their wallet keys and the intended bank contract. The administrator is trusted to freeze/unfreeze and pause/resume appropriately, but cannot directly alter or seize balances through a contract function. A verifier must trust the selected chain, contract and RPC data. A separately configured RPC verifier reduces dependence on the receipt service but does not by itself prove a dishonest node truthful.')
add('All demo accounts are deterministic and unlocked to make classroom operation simple. This is not production authentication. A one-host chain cannot establish the resilience or independent consensus of a multi-operator network; the report confines its claims to the actual local implementation and measurements.','SmallCustom')

# 4
page(4,'Smart contract and accounting model')
add('LedgerBank.sol is compiled with Solidity 0.8.30, optimizer runs = 200, targeting Shanghai. The bank is a native-ETH vault with explicit per-customer liabilities. All monetary values use uint256 wei and JavaScript BigInt/decimal strings, avoiding floating-point rounding in balances.')
story.append(Preformatted('sum(customer bank balances) = totalLiabilities <= vault ETH',styles['CodeCustom']))
table(['Operation (amount x)','Customer ledger change','Vault / liabilities'],[['Deposit','Depositor balance += x','Vault += x; liabilities += x'],['Withdrawal','Owner balance -= x','Vault -= x; liabilities -= x'],['Internal transfer','Sender -= x; recipient += x','Both unchanged'],['Forced ETH','No customer credit','Vault rises; surplus may appear']],[143,192,172])
add('Gas is paid from the external transaction initiator\'s wallet, outside bank balances. The contract rejects ordinary raw ETH sends so they cannot accidentally become uncredited deposits. Forced ETH can bypass receive(); it is reported as surplus rather than credited to a customer. Solidity documents this forced-value possibility [2]. No administrative surplus-withdrawal method exists.')
h('State and transaction records')
table(['State','Purpose'],[['customers[wallet]','Salted identity commitment; one enrollment per wallet'],['accounts[wallet]','Number, openedAt, frozen flag and exact balance'],['totalLiabilities','Aggregate amount owed to customer accounts'],['requestSequences[wallet][requestId]','Sequence of a successful request; prevents a duplicate operation'],['BankTransaction event','Sequence, parties, operation, amount, post-balances, request and memo hashes']],[198,309])
h('Withdrawal safety')
add('Withdrawal checks service state, account status, positive amount and available balance. It records the request and debits balance/liabilities before the external payout. The nonReentrant guard blocks callbacks into all money operations. If the receiver rejects payment, require(success) reverts the entire transaction, restoring balances, liabilities, request state and the sequence counter. This follows checks-effects-interactions [2].')
add('Internal transfers have no external call. Checked arithmetic rejects underflow/overflow, while the administrator cannot change any customer balance directly. Test-only malicious receivers are kept in TestActors.sol and are not deployed by normal startup.','SmallCustom')

# 5
page(5,'Account security and reliable requests')
h('Registration and account creation')
add('A customer registers a commitment to a fictional name, customer reference and random salt. The blockchain stores the commitment rather than those readable fields. The same wallet then calls openAccount to create its single numbered account with zero balance. Registration shows wallet control; it is not legal identity verification or KYC.')
add('The administrator address is immutable and reserved from customer registration. Every money operation identifies its source through msg.sender, not an editable owner parameter or tx.origin. The transfer recipient must already have an active account. Deposits, withdrawals and transfers reject zero amounts; withdrawals and transfers reject overdrafts.')
h('Freeze and emergency pause')
table(['Control','Effect','Boundary'],[['Account freeze','Blocks deposit, withdrawal and transfers in either direction','Balance/history reads remain available'],['Global pause','Blocks money operations and new registration/account creation','Administrator can resume; reads remain available'],['Administrative authority','Can change freeze and pause flags','Cannot edit balances, reset requests or erase events']],[128,225,154])
add('Freeze/pause improves incident response but is also a trust dependency: an administrator can stop access to withdrawals. A real deployment would require explicit governance, protected keys and recovery procedures. None are implied by this classroom implementation.')
h('Idempotency and interrupted submissions')
add('The browser generates a random bytes32 request ID and saves it with the operation, exact wei amount, recipient and memo hash before sending. Solidity records the sequence of each successful ID per initiating wallet. Reusing an ID cannot perform a second deposit, withdrawal or transfer, even if a client changes the operation type.')
add('If a response is lost, the pending banner checks whether the original request executed. A retry uses the same ID and parameters. It may still consume an extra network fee if a duplicate is mined and reverts, but cannot debit the bank twice. Failed transactions roll back ID consumption. Different new IDs represent different authorized payments.')
callout('A local reminder is not a cancellation','Dismissing the pending banner or clearing browser storage cannot cancel a transaction already submitted to the chain. The user must check history before making a replacement with a new ID. The contract protects same-ID retries; it cannot infer the user\'s intent across unrelated IDs.')

# 6
page(6,'Immutable history and transaction receipts')
add('Successful money operations emit sequenced BankTransaction events. Customer history includes deposits, withdrawals and both transfer directions. The event carries the exact amount and post-operation bank balances, preserving an auditable record even after later payments change the current balance.')
add('A receipt combines the bank-emitted event with transaction and block evidence: chain and contract, transaction hash, block hash/number/time, initiator, parties, operation, amount, balances, request ID, memo hash, gas used, effective gas price and paid fee. The zero-address event party denotes the external-wallet boundary and has a displayed bank balance of zero.')
h('Observed transfer receipt: historical evaluation sample')
r=D['samples']['transfer']
table(['Receipt field','Value from the actual mined transaction'],[['Operation / sequence',f'{r["operation"]} / {r["sequence"]}'],['Amount',f'{int(r["amountWei"])/1e18:.4f} local ETH'],['Transaction hash',r['transactionHash']],['Ledger sender',r['sender']],['Ledger recipient',r['recipient']],['Block / timestamp',f'{r["blockNumber"]} / {datetime.datetime.fromtimestamp(r["timestamp"],datetime.timezone.utc).isoformat()}'],['Gas / fee',f'{r["gasUsed"]} gas / {int(r["feeWei"])/1e18:.9f} ETH']],[133,374])
h('Verification and receipt integrity')
add('The receipt verifier reconstructs every field from a trusted RPC and compares the complete JSON object, ignoring only key order and formatting. Changed amounts, recipient addresses, fees or additional unsigned fields fail comparison. The observed original receipt returned VERIFIED; an edited amount returned ALTERED. Tests also reject unrelated and unmined transactions.')
add('The receipt helper checks the bank log address and its canonical block hash. An outer forwarding transaction can be supported because the bank event identifies the operation even when transaction.to is a smart account. The current format expects one bank operation per outer transaction; multi-operation aggregators need a different receipt structure.')
add('JSON download and a printable HTML receipt are available in the app. A separate CLI can verify the JSON directly against a chosen RPC. A printout alone is not a cryptographic proof, and mined inclusion is not public-chain finality. Historical samples in evidence belong to isolated evaluation chains; npm run demo produces live samples for a fresh local installation.','SmallCustom')

# 7
page(7,'Implementation, deployment and local setup')
table(['Layer','Implementation'],[['Runtime / web','Node.js 24.19.0 evaluated; Express 5.1.0; HTML/CSS/ES modules'],['Blockchain client','ethers 6.15.0; exact wei values and transaction receipts'],['EVM / compiler','Ganache 7.9.2; Solidity/solc 0.8.30; Shanghai'],['Persistence','Stopped/restarted chain and deployment metadata under data/'],['Evaluation','Node test runner; isolated workers; CPU/RSS sampling'],['Report','ReportLab and Matplotlib; optional Python tooling only']],[144,363])
h('Actual contract deployment')
table(['Receipt field','Recorded value'],[['Bank address',DEP['address']],['Transaction hash',DEP['transactionHash']],['Chain / block',f'{DEP["chainId"]} / {DEP["blockNumber"]}'],['Compiler',DEP['compiler']],['Source SHA-256',DEP['sourceHash']]],[127,380])
add('The contract was deployed and executed on the local EVM, not simulated by returning fake transaction IDs. The deployment record includes receipt gas and price. Startup checks source fingerprint and the administrator before reusing saved state. A complete restart test reopens existing accounts, balances, backing, history and receipts.')
h('Run the supplied project')
story.append(Preformatted('npm ci\nnpm start\n# Open http://localhost:3000\n# Second terminal, optional live demonstration:\nnpm run demo',styles['CodeCustom']))
add('Extract the ZIP and open its package.json folder in Command Prompt or a terminal. Node.js 24 LTS is recommended; no Docker, XAMPP, paid service or separate database is required. The application uses HTTP port 3000 and RPC port 8545; stop previous assignment projects if those ports are in use. Keep the terminal open and preserve data/ across restarts.')
add('The README covers each role, manual operations, pending requests, optional browser-wallet settings, receipt verification and Windows dependency troubleshooting. The optional external deploy script deploys only the contract; it does not convert this local setup into a production banking service.','SmallCustom')

# 8
page(8,'Security and correctness evaluation')
add(f'The final automated suite passed {T["passed"]}/{T["passed"]} tests with zero failures. Tests execute actual contracts and HTTP requests, including malicious receiver contracts, one-wei accounting, mined payment failure and persistent restart. The live demo and independent receipt CLI also passed original/altered comparisons.')
table(['Risk / requirement','Control or assertion','Result'],[['Unauthorized registration/account use','Enrollment required; one account; reserved admin','Rejected invalid/duplicate access'],['Rounding or fabricated value','BigInt/uint256 wei; exact msg.value accounting','One-wei and high-precision values preserved'],['Overdraft / invalid transfer','Positive amount; active recipient; available balance','Rejected; balances unchanged'],['Duplicate payment request','Wallet-scoped request sequence','No second operation with same ID'],['Reentrant withdrawal callback','Shared guard and effects before payout','Reentry failed; only intended payout occurred'],['Recipient rejects withdrawal','require(success) reverts all state','Balance, liabilities and request restored'],['Forced ETH surplus','Backing >= liabilities, not strict equality','Surplus did not credit customer balances'],['Unauthorized administrative change','onlyAdministrator modifiers','Non-admin freeze/pause rejected'],['Receipt falsification','Rebuild exact event/transaction fields','Changed and extra fields rejected'],['Persistence failure on restart','Saved EVM and deployment together','Balances/history/receipts survived reopen'],['HTTP boundary abuse','Host/Origin checks, JSON limits, CSP, RPC allowlist','Foreign requests and management RPC rejected']],[127,216,164])
h('What passing tests establish')
add('These assertions support the implementation\'s tested authorization, exact accounting and failure behavior. They are not a formal proof, external audit or guarantee against all attacks. Solidity guidance highlights both external-call reentrancy and public visibility of contract data [2]. The browser account selector is explicitly a local test convenience, not a secure multi-user login.')
add('Wallet compromise, incorrect recipient selection, malicious administrators, a dishonest RPC, lost keys, real identity checks and public-chain reorganization remain risks outside this prototype. Browser interaction, optional wallet integration and print rendering were not automated; those manual checks are described in the README.','SmallCustom')

# 9
page(9,'Performance methodology and metric definitions')
table(['Setting','Measured experiment configuration'],[['Environment',f'{ENV["cpu"]}; {ENV["logicalCpus"]} logical CPUs reported; {fmt(ENV["memoryGiB"])} GiB'],['Runtime',f'Node {ENV["node"]}, {ENV["platform"]}/{ENV["architecture"]}; Ganache JavaScript fallback'],['Chain settings','31337; Shanghai; 0.25-second mining interval; one mined receipt'],['Price / value','Fixed legacy gas price 2 gwei; load amount 0.001 ETH'],['Operation latency','2 warmups + 20 measured trials per deposit/withdrawal/transfer'],['Load comparisons','N=30/60/120 at C=4; C=1/4/8 at N=120; three repeats'],['Load composition','Equal numbers of deposits, withdrawals and internal transfers'],['Isolation / resources','Fresh process and chain per run; 50 ms memory sampling']],[144,363])
h('Transaction metrics')
add('<b>Fee:</b> receipt.gasUsed × receipt.gasPrice in wei; divide by 10<super>18</super> for ETH. Every stored receipt is checked with integer arithmetic. The average financial transaction fee includes measured deposit, withdrawal and transfer operations, excluding deployment, registration, opening, prefunding and warmups [3].')
add('<b>Latency:</b> before transaction submission until the first successful mined receipt. The separate confirmation-wait interval starts after submission acknowledgment. End-to-end workflow timing additionally includes generating the HTTP receipt. Human typing and wallet approval time are excluded. One local receipt is inclusion, not public-chain finality.')
add('<b>TPS:</b> successful load receipts / workload wall seconds. <b>Success rate:</b> successful receipts / attempted transactions × 100. Setup is excluded; each concurrent customer has its own sequential nonce stream. Final transaction counts and expected liabilities are reconciled against actual bank state.')
h('CPU and memory definitions')
add('<b>CPU% (one core)</b> = 100 × (delta user CPU + delta system CPU) / elapsed wall time, using consistent units. A second value divides by the reported logical CPU count. <b>RSS</b> is resident process memory sampled every 50 ms; start, end and maximum observed values are retained. When current RSS is unavailable, a labeled process-lifetime peak is used [4].')
add('Load calls use explicit nonces and a 300,000 gas limit; workflow calls estimate gas. Actual fees use consumed gas. Resource scope covers the worker EVM/client/driver (plus API in workflow), excluding browser and parent orchestrator. Fresh processes limit carryover; host CPU is shared. Error bars are three-run sample standard deviations. p95 is nearest-rank; the median averages the two central values when needed.','SmallCustom')

# 10
page(10,'Deployment, gas and average transaction cost')
table(['Deployment measurement','Actual value'],[['Gas used',f'{int(DEP["gasUsed"]):,}'],['Effective gas price','2,000,000,000 wei = 2 gwei'],['Deployment fee',f'{int(DEP["feeWei"]):,} wei = {int(DEP["feeWei"])/1e18:.9f} ETH'],['Observed deployment latency',f'{fmt(DEP["latencyMs"])} ms']],[219,288])
h('Operation-level gas and fees')
gasrows=[]
for key,label in [('registration','Customer registration'),('account-opening','Account opening'),('deposit','Deposit'),('withdrawal','Withdrawal'),('transfer','Internal transfer')]:
    g=GAS[key];gasrows.append([label,g['gas']['n'],fmt(g['gas']['mean'],1),f'{g["feeEth"]["mean"]:.9f}'])
table(['Operation','n','Mean gas','Mean fee (ETH)'],gasrows,[201,40,114,152])
add(f'The weighted mean across {B["averageFinancialTransactionFeeEth"]["n"]:,} measured financial transactions was <b>{B["averageFinancialTransactionFeeEth"]["mean"]:.9f} ETH</b>. Each of the three financial operations contributes equally because both the workflow trials and load runs are balanced. These are synthetic local currency costs; no real ETH was spent.')
h('Interpreting gas differences')
add('Deployment writes bytecode and initial state. Registration and account opening allocate account data. Deposits update balance, liability, sequence and request storage. Withdrawals additionally execute a native-ETH payout; internal transfers update both parties but do not move vault ETH. Zero-to-nonzero storage writes, counter updates and calldata bytes can change gas even for the same named operation.')
add('The benchmark fixes the price at 2 gwei to separate operation gas from a changing fee market. Actual public-network ETH costs would depend on effective gas price, congestion and deployment choices. No fiat exchange-rate assumption is made. The receipt fee is calculated from effective price, not merely a submitted gas limit [3].')
callout('Reads and failed transactions','Balance inquiry, history and receipt verification use read calls, with no transaction fee in this application, but still consume computing resources. Deliberately rejected security tests are excluded from the successful-load average. A mined failed or duplicate transaction may pay gas even though its bank changes revert.')

# 11
page(11,'Deposit, withdrawal and transfer latency')
story.append(Image(str(TMP/'latency.png'),width=WIDTH,height=190));story.append(Spacer(1,8))
add('<b>Figure 2.</b> Submission-to-first-receipt latency, 20 measured trials per operation after two warmups. p95 is descriptive for this small sample.','SmallCustom')
rows=[]
for key,label in [('deposit','Deposit'),('withdrawal','Withdrawal'),('transfer','Transfer')]:
    op=OP[key];rows.append([label,fmt(op['transactionMs']['mean']),fmt(op['transactionMs']['median']),fmt(op['transactionMs']['p95']),fmt(op['confirmationWaitMs']['mean']),fmt(op['endToEndMs']['mean'])])
table(['Operation','Mean ms','Median ms','p95 ms','Confirm wait ms','With receipt ms'],rows,[99,75,78,73,90,92])
h('Confirmation-time interpretation')
add('The confirmation-wait column measures acknowledgment-to-receipt time. It is a subset of submission-to-receipt latency, not an additional delay to add again. The configured miner creates blocks every 250 ms; a request may arrive anywhere in that interval. Gas estimation, JSON-RPC submission, transaction acknowledgment and receipt polling also affect client-observed timing.')
add(f'HTTP receipt generation averaged {fmt(W["receiptHttpMs"]["mean"])} ms over the measured operations. The last column includes it after transaction inclusion. The banking transaction has already succeeded before receipt download: a failed download must not trigger a new payment with a different request ID.')
h('Limits of these results')
add('The measurements use a local network and synthetic accounts without a human signing delay. They do not include public validator congestion, wide-area latency, durable finality or adversarial chain reorganization. A public deployment needs an explicit confirmation policy and different performance evaluation.')
add('The raw workflow array contains each operation\'s submission, confirmation, transaction, HTTP-receipt and end-to-end timings. Resource monitoring spans the workflow including its warmups; workload CPU/RSS comparisons on p. 13 use the separate timed load experiments.','SmallCustom')

# 12
page(12,'Throughput and scalability under different loads')
story.append(Image(str(TMP/'scalability.png'),width=WIDTH,height=198));story.append(Spacer(1,7))
add('<b>Figure 3.</b> Three repetitions per condition on fresh processes/chains. Left changes volume at fixed concurrency; right changes concurrency at fixed volume. Error bars show sample standard deviation.','SmallCustom')
rows=[]
for n,c in [(30,4),(60,4),(120,4),(120,1),(120,8)]:
    runs=group(n,c);rows.append([n,c,' / '.join(fmt(s['tps']) for s in runs),fmt(mean(n,c)),f'{sum(s["successes"] for s in runs)}/{n*3}',f'{statistics.mean(s["successRate"] for s in runs):.0f}%'])
table(['N','C','TPS: runs 1 / 2 / 3','Mean TPS','Success','Rate'],rows,[33,33,185,81,93,82])
add(f'At four concurrent customers, observed mean throughput was {fmt(mean(30,4))}, {fmt(mean(60,4))} and {fmt(mean(120,4))} TPS for 30, 60 and 120 transactions. The operation mix and transaction value were held constant. Small-run overhead, local scheduling and block timing affect the differences; this is not evidence of unbounded scalability.')
add(f'At N=120, moving from one to four to eight customers changed mean throughput from {fmt(mean(120,1))} to {fmt(mean(120,4))} to {fmt(mean(120,8))} TPS. Independent sender nonce streams let multiple transactions share mining intervals. The gain is limited by the same local EVM and processing resources.')
add(f'All {SUCCEEDED:,} of {TOTAL:,} load attempts succeeded. Each run reconciled the final event count, aggregate customer balances, total liabilities and vault backing. Balanced deposits and withdrawals produced the expected net liability change, while transfers preserved aggregate value. Raw per-run results and failures, if any, remain in the evidence files.')
add('The load interval measures transaction execution and confirmation, excluding enrollment/prefunding and HTML/receipt delivery. Historical-log query scalability, very large account populations and multi-node/network resilience were not measured. Those claims should not be inferred from these TPS results.','SmallCustom')

# 13
page(13,'CPU and memory usage')
story.append(Image(str(TMP/'resources.png'),width=WIDTH,height=187));story.append(Spacer(1,7))
add('<b>Figure 4.</b> Mean run-level CPU percentage and maximum reported RSS over three repetitions. The one-core CPU scale can exceed 100% if multiple threads execute concurrently.','SmallCustom')
rows=[]
for n,c in [(30,4),(60,4),(120,4),(120,1),(120,8)]:rows.append([f'{n} / {c}',fmt(resource_mean(n,c,'cpuPercentOneCore')),fmt(resource_mean(n,c,'cpuPercentAllLogicalCpus')),fmt(resource_mean(n,c,'startRssMiB')),fmt(resource_mean(n,c,'endRssMiB')),fmt(resource_mean(n,c,'sampledPeakRssMiB'))])
table(['N / C','CPU one core %','CPU all cores %','Start RSS MiB','End RSS MiB','Max RSS MiB'],rows,[67,87,92,87,87,87])
h('Measured scope and interpretation')
add('Each resource measurement covers one isolated Node process containing the Ganache EVM, RPC client and load driver. The process starts fresh for each repetition. CPU time is sampled at the start/end of the timed load, so compilation, enrollment and initial funding are excluded from its CPU percentage. Memory includes the runtime and its already-loaded state; it is not an incremental bytes-per-transaction estimate.')
add(f'At 120 transactions and eight customers, mean process CPU was {fmt(resource_mean(120,8,"cpuPercentOneCore"))}% of one core and mean maximum reported RSS was {fmt(resource_mean(120,8,"sampledPeakRssMiB"))} MiB. Dividing CPU by the {ENV["logicalCpus"]} reported logical CPUs gives the normalized column; it should not be read as whole-machine monitoring.')
kinds=sorted(set(s['resources']['rssKind'] for s in B['scenarios']))
add('Observed memory measurement mode: <b>'+html.escape('; '.join(kinds))+'</b>. Current RSS is sampled every 50 ms; sampling can miss brief peaks. The separate process high-water mark is also retained in JSON. A fallback value, if used, includes earlier lifetime peaks and is explicitly identified.')
add('RSS includes native allocations as well as the JavaScript heap. Garbage collection, allocator behavior, operating-system scheduling and shared-host load can produce non-monotonic measurements. Three repetitions improve visibility of variability but do not prove a memory leak, absence of leaks, or long-term service capacity. Resource definitions follow Node process APIs [4].','SmallCustom')

# 14
page(14,'Discussion, future improvements and references')
h('Implementation outcomes and challenges')
add(f'LedgerBank implements all required banking functions and evaluates every requested metric. The evidence comprises {T["passed"]} passing tests, verifiable receipts, exact balance/fee checks and {SUCCEEDED:,} successful mixed load transactions. Withdrawal callbacks, duplicate requests and interrupted acknowledgments required explicit handling beyond a simple balance-transfer form.')
add('The design separates custody from accounting: bank balances represent liabilities backed by native vault ETH, while transaction fees belong to the external wallet. Surplus can arrive without a deposit event, so solvency uses assets >= liabilities. Receipts are reconstructed from immutable events and can be verified independently of the web receipt endpoint.')
h('Limitations and prioritized next steps')
add('<b>Governance and security:</b> independent security review, protected institutional keys, multisignature administration, recovery policies and limits on emergency controls. Real customer identity and compliance requirements need specialist institutional design; salted commitments do not provide them.')
add('<b>Deployment and privacy:</b> independently operated nodes, trusted RPC/finality policies, backup/recovery testing, private or consent-based transaction visibility and an indexed history service. A local deterministic Ganache chain is not a real banking network.')
add('<b>Further evaluation:</b> larger account/transaction populations, longer sustained workloads, network delay and failures, multi-node consensus, concurrent adversarial actions, receipt aggregation, browser/wallet interaction and accessible print/device checks. The supplied resource results cover only the stated local worker scope.')
h('Reproducibility and submission')
add('Run npm ci, npm start and npm run demo for the local workflow; run npm run evaluate to reproduce tests and measurements. Read README.md and docs/VIVA_GUIDE.md before presenting. The report contains 14 pages, with student identity fields left for completion. No video is included, as explicitly instructed.')
h('References')
for ref in [
'[1] MSc Blockchain Course. Assignment 3: Blockchain-Based Secure Banking Transaction System. Supplied ass-3.pdf, pp. 1-2.',
'[2] Solidity documentation. Security Considerations. https://docs.soliditylang.org/en/latest/security-considerations.html (accessed 3 September 2026). Implementation pinned to 0.8.30.',
'[3] Ethereum Foundation. Gas and fees. https://ethereum.org/developers/docs/gas/ (accessed 3 September 2026).',
'[4] Node.js documentation. Process: cpuUsage, memoryUsage and resourceUsage. https://nodejs.org/api/process.html (accessed 3 September 2026). Evaluation runtime: Node 24.19.0.',
'[5] Submitted project evidence: benchmark-results.json, transactions.csv, scalability.csv, tests.log, test-summary.json, cli-integration.json and sample receipt files. Generated by the delivered source.'
]:add(html.escape(ref),'SmallCustom')

def furniture(canvas,doc):
    canvas.saveState();canvas.setStrokeColor(LINE);canvas.line(44,38,551,38);canvas.setFont('DejaVu',7);canvas.setFillColor(GRAY);canvas.drawString(44,25,'LedgerBank | MSc Blockchain | Assignment 3');canvas.drawRightString(551,25,f'{doc.page} / 14');canvas.setFillColor(BLUE);canvas.rect(44,804,34,3,fill=1,stroke=0);canvas.restoreState()
OUT.parent.mkdir(parents=True,exist_ok=True)
document=SimpleDocTemplate(str(OUT),pagesize=(595,842),rightMargin=44,leftMargin=44,topMargin=49,bottomMargin=49,title='Assignment 3 - Blockchain-Based Secure Banking Transaction System',author='Student submission - complete identity fields',subject='Implementation, security, accounting and measured blockchain performance')
document.build(story,onFirstPage=furniture,onLaterPages=furniture)
print(OUT)

#!/usr/bin/env python3
"""A fixture API for the example apps in examples/apps/, with the Python standard library only.

Each app reads its records and its thread events from GET /api/<app>/... and sends each action to POST /api/actions.
The API decides each action and gives its receipt. The API owns the state, not the page.
Other GET paths give the files of src/, catalog/ and examples/ only, as tools/thread_server.py does.
The server listens on 127.0.0.1 only. All data is synthetic.
"""
import argparse
import copy
import json
import re
import sys
import threading

from thread_server import MAX_BODY, Handler as FileHandler, Server

DEFAULT_PORT = 8770
APPS = ('support', 'changes', 'inspection')

CUSTOMER_TEAM = {'type': 'human', 'id': 'u-alex', 'name': 'Alex P.'}
TRIAGE = {'type': 'agent', 'id': 'agent-triage', 'name': 'Triage agent'}
WRITER = {'type': 'agent', 'id': 'agent-reply', 'name': 'Reply agent'}
DESK = {'type': 'system', 'id': 'desk-api', 'name': 'Help desk'}
PLANNER = {'type': 'agent', 'id': 'agent-planning', 'name': 'Planning agent'}
POLICY = {'type': 'agent', 'id': 'agent-policy', 'name': 'Policy agent'}
REVIEWER = {'type': 'human', 'id': 'u-jordan', 'name': 'Jordan M.'}
CHANGE_LOG = {'type': 'system', 'id': 'change-api', 'name': 'Change log'}
INSPECTOR = {'type': 'human', 'id': 'u-dana', 'name': 'Dana I.'}
FIELD_AGENT = {'type': 'agent', 'id': 'agent-field', 'name': 'Field agent'}
DISPATCH = {'type': 'system', 'id': 'dispatch-api', 'name': 'Dispatch'}

TICKETS = [
    {'id': 'T-2041', 'title': 'Charged twice for one ride', 'customer': {'type': 'human', 'id': 'c-ines', 'name': 'Ines K.'},
     'email': 'ines.k@example.com', 'priority': 'High', 'channel': 'Email', 'opened': '2026-11-14', 'status': 'open',
     'body': 'My card shows two charges of 3.40 for ride R-88213 on Tuesday. I made one ride. Please refund the second charge.',
     'triage': [('Category', 'Billing'), ('Ride', 'R-88213'), ('Charges', '2 x 3.40'), ('Account', 'Monthly plan')],
     'note': 'Reply agent, please draft a reply. Check the ride log first.',
     'finding': 'The ride log shows one ride and two charges for R-88213. I drafted a refund reply.',
     'draft': 'Hello Ines, we are sorry for the double charge on ride R-88213. We refunded 6.80 to your card. '
              'The refund shows in 3 to 5 days.'},
    {'id': 'T-2042', 'title': 'Dock at Pier Street does not release bikes', 'customer': {'type': 'human', 'id': 'c-tomas', 'name': 'Tomas R.'},
     'email': 'tomas.r@example.com', 'priority': 'High', 'channel': 'App', 'opened': '2026-11-14', 'status': 'open',
     'body': 'Dock 14 at Pier Street shows a green light, but the bike stays locked. I tried three bikes.',
     'triage': [('Category', 'Equipment'), ('Station', 'Pier Street'), ('Dock', '14'), ('Reports today', '3')],
     'note': 'Reply agent, please draft a reply. The field team has the dock on its list.',
     'finding': 'The field team has a visit to Pier Street at 15:00 today. I drafted a reply.',
     'draft': 'Hello Tomas, thank you for the report. We locked dock 14 at Pier Street, and a technician '
              'visits the station today. Docks 1 to 13 work.'},
    {'id': 'T-2043', 'title': 'How do I pause my monthly plan?', 'customer': {'type': 'human', 'id': 'c-priya', 'name': 'Priya N.'},
     'email': 'priya.n@example.com', 'priority': 'Normal', 'channel': 'Email', 'opened': '2026-11-13', 'status': 'open',
     'body': 'I am away for six weeks in December. Can I pause my monthly plan and keep my member number?',
     'triage': [('Category', 'Account'), ('Plan', 'Monthly'), ('Member since', '2024-03-02')],
     'note': 'Reply agent, please draft a reply with the pause rule.',
     'finding': 'The plan rules permit a pause of up to 3 months. I drafted a reply.',
     'draft': 'Hello Priya, you can pause your plan for up to 3 months. Open Account, then Plan, then Pause. '
              'Your member number stays the same.'},
    {'id': 'T-2044', 'title': 'Receipt needs a company address', 'customer': {'type': 'human', 'id': 'c-lee', 'name': 'Lee W.'},
     'email': 'lee.w@example.com', 'priority': 'Low', 'channel': 'Email', 'opened': '2026-11-12', 'status': 'open',
     'body': 'Can you add my company address to the October receipt? I need it for my expense report.',
     'triage': [('Category', 'Billing'), ('Receipt', 'October 2026'), ('Rides', '18')],
     'note': 'Reply agent, please draft a reply.',
     'finding': 'A person can add an address on the receipt page. I drafted a reply.',
     'draft': 'Hello Lee, open Receipts, choose October 2026, and add the address in the Bill to field. '
              'Then download the receipt again.'},
]

RIDERSHIP = {'source': 'Synthetic ridership report 2026, section 3', 'locator': 'https://example.org/reports/ridership-2026#section-3'}
STANDARDS = {'source': 'Synthetic service standards, rule 4.2', 'locator': 'https://example.org/standards#rule-4-2'}
STOPS = {'source': 'Synthetic stop survey, page 7', 'locator': 'https://example.org/surveys/stops#page-7'}
CHANGES = [
    {'id': 'CR-311', 'title': 'Run route 12 every 15 minutes on Saturday', 'status': 'open', 'start': '2026-12-06',
     'summary': 'Saturday trips on route 12 are full from 10:00 to 16:00. The change adds 8 trips.',
     'facts': [('Route', '12 Harbor to Hillside'), ('Now', 'Every 20 minutes'), ('Proposed', 'Every 15 minutes'), ('Cost', '2 more buses, 6 more hours')],
     'claim': 'Saturday trips on route 12 are full at midday. A 15 minute interval meets the standard.',
     'evidence': [(PLANNER, RIDERSHIP, 'On Saturdays, route 12 carried an average of 61 riders for each trip between 10:00 and 16:00. '
                   'The bus has 60 places. Riders at Elm Street were left at the stop on 9 of 12 Saturdays.', 'an average of 61 riders for each trip between 10:00 and 16:00'),
                  (POLICY, STANDARDS, 'If the average load is more than 90 percent of the places for 3 months, the interval must be 15 '
                   'minutes or less. The planning team can add trips with the approval of a reviewer.', 'the interval must be 15 minutes or less')]},
    {'id': 'CR-312', 'title': 'Move the Elm Street stop 80 m north', 'status': 'open', 'start': '2027-01-10',
     'summary': 'The stop is next to a new school gate. The change moves it to the far side of the crossing.',
     'facts': [('Routes', '12 and 4'), ('Distance', '80 m north'), ('Shelter', 'Moves with the stop')],
     'claim': 'The stop survey shows a conflict with the school gate at 08:00 and 15:00.',
     'evidence': [(PLANNER, STOPS, 'At 08:00 and 15:00, buses at the Elm Street stop block the school gate for 2 to 4 minutes. '
                   'The far side of the crossing has space for a shelter.', 'block the school gate for 2 to 4 minutes')]},
    {'id': 'CR-313', 'title': 'Add a late trip on route 4', 'status': 'open', 'start': '2026-12-01',
     'summary': 'The last trip leaves at 22:10. Staff of the night shift at the depot ask for a trip at 23:30.',
     'facts': [('Route', '4 Station to Depot'), ('New trip', '23:30'), ('Cost', '1 more hour each day')],
     'claim': 'A late trip meets the request of the depot staff.',
     'evidence': [(POLICY, STANDARDS, 'A route with a night shift at its end needs a trip within 30 minutes of the end of the shift.', 'a trip within 30 minutes of the end of the shift')]},
]

INSPECTION_ID = 'I-0417'
CHECKLIST = [
    {'name': 'pump1', 'label': 'Pump 1 vibration', 'result': 'pass', 'detail': '2.1 mm/s on 2026-10-14'},
    {'name': 'pump2', 'label': 'Pump 2 vibration', 'result': 'pass', 'detail': '2.4 mm/s on 2026-10-14'},
    {'name': 'pressure', 'label': 'Outlet pressure', 'result': 'open', 'detail': 'Give the reading in bar'},
    {'name': 'seal', 'label': 'Valve V3 seal', 'result': 'open', 'detail': 'Write ok, worn or leak'},
    {'name': 'generator', 'label': 'Backup generator test', 'result': 'pass', 'detail': 'Ran 15 minutes on 2026-11-01'},
    {'name': 'fence', 'label': 'Site gate and fence', 'result': 'pass', 'detail': 'No damage'},
]
SEALS = {'ok': 'pass', 'worn': 'attention', 'leak': 'fail'}
NUMBER = re.compile(r'^\d{1,2}(\.\d{1,2})?$')


def text(message_id, actor, words):
    meta = {'mugham': {'actor': actor}}
    return [{'type': 'TEXT_MESSAGE_START', 'messageId': message_id, 'role': 'user' if actor['type'] == 'human' else 'assistant', 'metadata': meta},
            {'type': 'TEXT_MESSAGE_CONTENT', 'messageId': message_id, 'delta': words},
            {'type': 'TEXT_MESSAGE_END', 'messageId': message_id}]


def part(message_id, actor, fill):
    return [{'type': 'ACTIVITY_SNAPSHOT', 'messageId': message_id, 'activityType': 'mugham.fill',
             'metadata': {'mugham': {'actor': actor}}, 'content': {'format': 2, 'fill': fill}}]


def fill(component, data, **slots):
    return {'component': component, 'version': '0.1.0', 'data': data, **({'slots': slots} if slots else {})}


def facts(pairs):
    return [fill('fact', {'label': label, 'value': value}) for label, value in pairs]


def ticket_events(ticket):
    tid = ticket['id']
    events = text(tid + '-m1', ticket['customer'], ticket['body'])
    events += part(tid + '-m2', TRIAGE, fill('card', {'title': 'Triage of ' + tid, 'summary': ticket['title'],
                                                      'facts': facts(ticket['triage'] + [('Priority', ticket['priority'])])},
                                             authorship=TRIAGE))
    if tid == 'T-2041':
        # The agent asks for a component that the catalog does not declare. The thread shows a refusal.
        events += part(tid + '-m3', TRIAGE, fill('mood-meter', {'level': 'upset'}, authorship=TRIAGE))
    events += text(tid + '-m4', CUSTOMER_TEAM, ticket['note'])
    events += text(tid + '-m5', WRITER, ticket['finding'])
    events += part(tid + '-m6', WRITER, fill('editable-form', {'title': 'Reply to ' + tid, 'submit_label': 'Send reply', 'fields': [
        fill('field', {'name': 'to', 'label': 'To', 'value': ticket['email'], 'disabled': True}),
        fill('field', {'name': 'reply', 'label': 'Reply', 'value': ticket['draft'],
                       'hint': 'Check each amount and date before you send.'})]}, authorship=WRITER))
    if ticket.get('sent'):
        events += text(tid + '-m7', CUSTOMER_TEAM, ticket['sent']['reply'])
        events += text(tid + '-m8', DESK, '%s is answered. Reference %s.' % (tid, ticket['sent']['reference']))
    return events


def change_events(change):
    cid = change['id']
    events = text(cid + '-m1', PLANNER, change['claim'])
    first = change['evidence'][0]
    events += part(cid + '-m2', PLANNER, fill('card', {'title': change['title'], 'summary': change['summary'], 'date': change['start'],
                                                       'date_label': 'Starts', 'facts': facts(change['facts'])},
                                              authorship=PLANNER, citation=first[1]))
    for number, (actor, source, passage, marked) in enumerate(change['evidence']):
        start = passage.index(marked)
        events += part('%s-e%d' % (cid, number), actor, fill('excerpt', {'passage': passage, 'span_start': start, 'span_end': start + len(marked)},
                                                               authorship=actor, citation=source))
    if change.get('decision'):
        decision = change['decision']
        events += text(cid + '-m9', CHANGE_LOG, '%s %s %s. Reference %s.' % (REVIEWER['name'], change['status'], cid, decision['reference']))
    return events


def inspection_events(inspection):
    iid = inspection['id']
    def checklist(items):
        items = [fill('check-item', {key: item[key] for key in ('label', 'result', 'detail')}) for item in items]
        return part(iid + '-list', FIELD_AGENT, fill('inspection-checklist', {'title': 'Checklist ' + iid, 'site': 'Pump station 4, North Ridge',
                                                                                'items': items}, authorship=FIELD_AGENT))

    events = text(iid + '-m1', DISPATCH, 'Inspection %s at Pump station 4 is assigned to %s. It is due today.' % (iid, INSPECTOR['name']))
    events += text(iid + '-m2', FIELD_AGENT, 'Here is the checklist from the last visit. Two items need a check today.')
    events += checklist(CHECKLIST)
    events += part(iid + '-form', FIELD_AGENT, fill('editable-form', {'title': 'Findings for ' + iid, 'submit_label': 'Save findings', 'fields': [
        fill('field', {'name': 'pressure', 'label': 'Outlet pressure in bar', 'value': '', 'hint': 'A number, for example 4.2.'}),
        fill('field', {'name': 'seal', 'label': 'Valve V3 seal', 'value': '', 'hint': 'Write ok, worn or leak.'}),
        fill('field', {'name': 'note', 'label': 'Note', 'value': ''})]}, authorship=FIELD_AGENT))
    if inspection.get('findings'):
        findings = inspection['findings']
        words = 'The findings are saved as %s. ' % findings['reference']
        words += ('Valve V3 seal needs work. I opened work order WO-5521 for a new seal. '
                  if findings['seal'] != 'ok' else 'All items pass. ')
        # The API adds events only at the end. A new snapshot with the same message id replaces the checklist.
        events += checklist(inspection['items'])
        events += text(iid + '-m3', FIELD_AGENT, words + 'Close the inspection when you leave the site.')
        events += part(iid + '-close', FIELD_AGENT, fill('action-button', {'label': 'Close ' + iid,
                                                                            'description': 'Send the checklist to the maintenance team.'}))
    if inspection.get('closed'):
        events += text(iid + '-m4', DISPATCH, '%s is closed. Reference %s.' % (iid, inspection['closed']))
    return events


def new_state():
    return {'lock': threading.Lock(), 'receipts': 0,
            'tickets': {item['id']: item for item in copy.deepcopy(TICKETS)},
            'changes': {item['id']: item for item in copy.deepcopy(CHANGES)},
            'inspection': {'id': INSPECTION_ID, 'items': copy.deepcopy(CHECKLIST), 'findings': None, 'closed': None}}


def decide(state, request):
    """Decide one request. The kit does not decide. This API decides, and it gives the receipt."""
    if not isinstance(request, dict) or not isinstance(request.get('id'), str) or not isinstance(request.get('arguments'), dict):
        return 400, {'error': 'The request must have an id and arguments.'}
    tool, args = request.get('tool'), request['arguments']
    no = lambda message: (200, {'id': request['id'], 'ok': False, 'message': message})

    def yes(message, prefix):
        state['receipts'] += 1
        return 200, {'id': request['id'], 'ok': True, 'message': message, 'reference': '%s-%04d' % (prefix, state['receipts'])}

    if tool == 'desk.send_reply':
        ticket = state['tickets'].get(args.get('ticket_id'))
        reply = args.get('reply')
        if ticket is None:
            return no('The API does not know this ticket.')
        if ticket['status'] != 'open':
            return no('The ticket %s is already answered.' % ticket['id'])
        if not isinstance(reply, str) or not reply.strip():
            return no('The reply is empty.')
        status, body = yes('The reply to %s is sent%s.' % (ticket['id'], '' if reply == ticket['draft'] else ', with the edits of a person'), 'MSG')
        ticket['status'] = 'answered'
        ticket['sent'] = {'reply': reply.strip(), 'reference': body['reference']}
        return status, body
    if tool in ('change.approve', 'change.reject'):
        change = state['changes'].get(args.get('change_id'))
        if change is None:
            return no('The API does not know this change.')
        if change['status'] != 'open':
            return no('The change %s is already %s.' % (change['id'], change['status']))
        result = 'approved' if tool == 'change.approve' else 'rejected'
        status, body = yes('The change %s is %s.' % (change['id'], result), 'CHG')
        change['status'] = result
        change['decision'] = {'reference': body['reference']}
        return status, body
    if tool in ('inspection.save_findings', 'inspection.close'):
        inspection = state['inspection']
        if args.get('inspection_id') != inspection['id']:
            return no('The API does not know this inspection.')
        if inspection['closed']:
            return no('The inspection %s is already closed.' % inspection['id'])
        if tool == 'inspection.close':
            if not inspection['findings']:
                return no('Save the findings before you close the inspection.')
            status, body = yes('The inspection %s is closed.' % inspection['id'], 'INS')
            inspection['closed'] = body['reference']
            return status, body
        pressure = args.get('pressure', '').strip() if isinstance(args.get('pressure'), str) else ''
        seal = args.get('seal', '').strip().lower() if isinstance(args.get('seal'), str) else ''
        if not NUMBER.match(pressure) or not 0 < float(pressure) <= 20:
            return no('Give the outlet pressure as a number from 0.1 to 20.')
        if seal not in SEALS:
            return no('Write ok, worn or leak for the valve seal.')
        status, body = yes('The findings for %s are saved.' % inspection['id'], 'INS')
        for item in inspection['items']:
            if item['name'] == 'pressure':
                item.update(result='pass' if 1.5 <= float(pressure) <= 6 else 'attention', detail='%s bar today' % pressure)
            if item['name'] == 'seal':
                item.update(result=SEALS[seal], detail='%s today' % seal.capitalize())
        inspection['findings'] = {'reference': body['reference'], 'seal': seal}
        return status, body
    return no('The API does not know this tool.')


def summary(ticket):
    return {key: ticket[key] for key in ('id', 'title', 'priority', 'channel', 'opened', 'status')} | {'customer': ticket['customer']['name']}


ROUTES = [
    (re.compile(r'^/api/support/tickets$'), lambda state: {'tickets': [summary(item) for item in state['tickets'].values()]}),
    (re.compile(r'^/api/support/tickets/(T-\d{4})/events$'), lambda state, key: key in state['tickets'] and {'events': ticket_events(state['tickets'][key])}),
    (re.compile(r'^/api/changes$'), lambda state: {'changes': [{key: item[key] for key in ('id', 'title', 'status', 'start')}
                                                               for item in state['changes'].values()]}),
    (re.compile(r'^/api/changes/(CR-\d{3})/events$'), lambda state, key: key in state['changes'] and {'events': change_events(state['changes'][key])}),
    (re.compile(r'^/api/changes/log$'), lambda state: {'log': [{'change': item['id'], 'title': item['title'], 'status': item['status'],
                                                                 'reference': item['decision']['reference']}
                                                                for item in state['changes'].values() if item.get('decision')]}),
    (re.compile(r'^/api/inspection/(I-\d{4})/events$'), lambda state, key: key == state['inspection']['id'] and {'events': inspection_events(state['inspection'])}),
]


class Handler(FileHandler):
    server_version = 'mugham-apps-example'

    def json(self, status, body):
        self.send(status, json.dumps(body).encode(), 'application/json')

    def do_GET(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        path = self.path.split('?', 1)[0]
        if path.startswith('/api/'):
            for pattern, route in ROUTES:
                match = pattern.match(path)
                if match:
                    with self.server.state['lock']:
                        body = route(self.server.state, *match.groups())
                    return self.json(200, body) if body else self.send(404, b'', 'text/plain')
            return self.send(404, b'', 'text/plain')
        # The file server of the thread example also streams /events. This server has no event stream.
        if path == '/events':
            return self.send(404, b'', 'text/plain')
        # A folder of an app gives its index.html, so each app has a short URL.
        if path.startswith('/examples/apps/') and path.endswith('/'):
            self.path = path + 'index.html'
        return super().do_GET()

    def do_POST(self):
        if not self.host_ok():
            return self.send(403, b'', 'text/plain')
        if self.path != '/api/actions':
            return self.send(404, b'', 'text/plain')
        # Only a page of this server can send a request.
        origin = self.headers.get('Origin')
        if origin is not None and origin != 'http://%s' % self.headers.get('Host', ''):
            return self.send(403, b'', 'text/plain')
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self.send(415, b'', 'text/plain')
        try:
            size = int(self.headers.get('Content-Length', ''))
        except ValueError:
            return self.send(411, b'', 'text/plain')
        if size < 0 or size > MAX_BODY:
            return self.send(413, b'', 'text/plain')
        try:
            request = json.loads(self.rfile.read(size))
        except (ValueError, UnicodeDecodeError):
            return self.send(400, b'', 'text/plain')
        with self.server.state['lock']:
            status, body = decide(self.server.state, request)
        self.json(status, body)


def make_server(port=0):
    server = Server(('127.0.0.1', port), Handler)
    # Each server has its own copy of the synthetic records, so each run starts with the same state.
    server.state = new_state()
    return server


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--port', type=int, help='the port, or 0 for a free port. The default is %d, or a free port if it is busy' % DEFAULT_PORT)
    args = parser.parse_args(argv)
    try:
        server = make_server(DEFAULT_PORT if args.port is None else args.port)
    except OSError as error:
        if args.port is not None:
            print('The server cannot use port %d: %s. Choose a different port with the --port option.' % (args.port, error.strerror or error), file=sys.stderr)
            return 1
        server = make_server(0)
    base = 'http://127.0.0.1:%d/examples/apps/' % server.server_address[1]
    print(base, flush=True)
    for app in APPS:
        print('  %s%s/' % (base, app), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())

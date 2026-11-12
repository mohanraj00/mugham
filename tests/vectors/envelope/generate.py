#!/usr/bin/env python3
"""Write the envelope vectors in tests/vectors/envelope/, or check that the committed files agree.

Each expected result comes from the rules in docs/contracts/envelope.md. This script does not run the reader.
Change a case here, run this script with --write, and commit the two JSON files. The data is synthetic.
"""
import argparse
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent

H={'envelope':1,'agui':'1.0'}
def actor(t,i,n=None):
    a={'type':t,'id':i}
    if n: a['name']=n
    return a
def meta(a): return {'mugham':{'actor':a}}
def env(**k):
    e=dict(H); e.update(k); return e
FALLBACK='The kit does not know this part type, so it does not show the part.'
fact=lambda v:{'component':'fact','version':'0.1.0','data':{'label':'Due','value':v}}
PA=actor('human','person-a','Person A'); PB=actor('human','person-b','Person B')
AP=actor('agent','agent-plan','Planner'); AC=actor('agent','agent-check','Checker')

envelopes=[
 dict(name='a final text message of a person', schema=True,
   envelope=env(threadId='t-1',messageId='m-1',role='user',actor=PA,state='final',parts=[{'type':'text','text':'Is the loan due?'}]),
   result=env(threadId='t-1',messageId='m-1',role='user',actor=PA,state='final',parts=[{'type':'text','text':'Is the loan due?'}])),
 dict(name='a message with no actor is refused', schema=False,
   envelope=env(threadId='t-1',messageId='m-1',role='user',state='final',parts=[{'type':'text','text':'Hello'}]),
   result=env(threadId='t-1',messageId='m-1',state='refused',errors=['actor: a required field is missing'])),
 dict(name='an actor with an unknown type and an empty id is refused', schema=False,
   envelope=env(messageId='m-1',actor={'type':'robot','id':''},state='final',parts=[]),
   result=env(messageId='m-1',state='refused',errors=['actor.type: must be human, agent or system','actor.id: must be an id of 1 to 128 characters'])),
 dict(name='an unknown part type shows as a text fallback with no data', schema=True,
   envelope=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'chart','points':[1,2],'html':'<b>x</b>'}]),
   result=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'fallback','partType':'chart','text':FALLBACK}])),
 dict(name='a long unknown part type name is cut to 40 characters', schema=True,
   envelope=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'x'*50}]),
   result=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'fallback','partType':'x'*37+'...','text':FALLBACK}])),
 dict(name='a declared component', schema=True,
   envelope=env(messageId='m-1',actor=AC,state='final',parts=[{'type':'component','format':2,'fill':fact('2026-11-20')}]),
   result=env(messageId='m-1',actor=AC,state='final',parts=[{'type':'component','format':2,'fill':fact('2026-11-20')}])),
 dict(name='an undeclared component shows as a refusal', schema=True,
   envelope=env(messageId='m-1',actor=AC,state='final',parts=[{'type':'component','format':2,'fill':{'component':'chart','version':'0.1.0','data':{}}}]),
   result=env(messageId='m-1',actor=AC,state='final',parts=[{'type':'refusal','errors':['component: no contract has the name chart']}])),
 dict(name='a component part of fill format 1 shows as a refusal', schema=False,
   envelope=env(messageId='m-1',actor=AC,state='final',parts=[{'type':'component','format':1,'fill':fact('2026-11-20')}]),
   result=env(messageId='m-1',actor=AC,state='final',parts=[{'type':'refusal','errors':['parts[0].format: must be 2']}])),
 dict(name='markup in a text part stays text', schema=True,
   envelope=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'text','text':'<a href="https://example.com/">Renew</a> **now**'}]),
   result=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'text','text':'<a href="https://example.com/">Renew</a> **now**'}])),
 dict(name='a text part that is not a string shows as a refusal', schema=False,
   envelope=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'text','text':5}]),
   result=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'refusal','errors':['parts[0].text: must be a text of 100000 characters maximum']}])),
 dict(name='a part that is not an object shows as a refusal', schema=False,
   envelope=env(messageId='m-1',actor=AP,state='final',parts=['<b>hello</b>']),
   result=env(messageId='m-1',actor=AP,state='final',parts=[{'type':'refusal','errors':['parts[0]: must be an object with a type']}])),
 dict(name='a partial message with an error status', schema=True,
   envelope=env(threadId='t-1',runId='r-1',messageId='m-1',role='assistant',actor=AP,state='partial',parts=[{'type':'text','text':'Checking'},{'type':'status','state':'error','text':'The service did not answer.','code':'timeout'}]),
   result=env(threadId='t-1',runId='r-1',messageId='m-1',role='assistant',actor=AP,state='partial',parts=[{'type':'text','text':'Checking'},{'type':'status','state':'error','text':'The service did not answer.','code':'timeout'}])),
 dict(name='a different envelope version is refused', schema=False,
   envelope={'envelope':2,'agui':'1.0','messageId':'m-1','actor':AP,'state':'final','parts':[]},
   result=env(messageId='m-1',state='refused',errors=['envelope: must be 1'])),
 dict(name='a different AG-UI version and an unknown state are refused', schema=False,
   envelope={'envelope':1,'agui':'0.9','messageId':'m-1','actor':AP,'state':'done','parts':[]},
   result=env(messageId='m-1',state='refused',errors=['agui: must be 1.0','state: must be partial or final'])),
 dict(name='a refusal error longer than 300 characters is cut to 300 characters', schema=False,
   envelope=env(messageId='m-1',actor=AC,state='final',parts=[{'type':'refusal','errors':['x'*301]}]),
   result=env(messageId='m-1',actor=AC,state='final',parts=[{'type':'refusal','errors':['x'*297+'...']}])),
 dict(name='a refused envelope from the history keeps its errors', schema=True,
   envelope=env(threadId='t-1',messageId='m-1',state='refused',errors=['text: more than 100000 characters']),
   result=env(threadId='t-1',messageId='m-1',state='refused',errors=['text: more than 100000 characters'])),
 dict(name='a refused envelope keeps no actor and no parts', schema=False,
   envelope=env(messageId='m-1',actor=AP,state='refused',errors=['actor: a required field is missing'],parts=[{'type':'text','text':'Hello'}]),
   result=env(messageId='m-1',state='refused',errors=['actor: a required field is missing'])),
 dict(name='a refused envelope with no errors is refused again', schema=False,
   envelope=env(messageId='m-1',state='refused',errors=[]),
   result=env(messageId='m-1',state='refused',errors=['errors: must be a list of 1 to 20 texts of 300 characters maximum'])),
 dict(name='a refused envelope with an id that is not valid keeps its errors after the id error', schema=False,
   envelope=env(threadId=5,messageId='m-1',state='refused',errors=['text: more than 100000 characters']),
   result=env(messageId='m-1',state='refused',errors=['threadId: must be an id of 1 to 128 characters','text: more than 100000 characters'])),
 dict(name='a refused envelope keeps 20 errors maximum after the id error', schema=False,
   envelope=env(threadId=5,messageId='m-1',state='refused',errors=[f'error {i}' for i in range(20)]),
   result=env(messageId='m-1',state='refused',errors=['threadId: must be an id of 1 to 128 characters']+[f'error {i}' for i in range(19)])),
 dict(name='a value that is not an object is refused', schema=False,
   envelope='<p>hello</p>',
   result=env(state='refused',errors=['(envelope): must be an object'])),
]

R1={'threadId':'t-1','runId':'r-1'}
def ev(t,**k):
    e={'type':t}; e.update(k); return e
def msg(mid,a,role,state,parts,run=True):
    e=dict(H)
    if run: e.update(R1)
    e['messageId']=mid
    if role: e['role']=role
    e['actor']=a; e['state']=state; e['parts']=parts
    return e
def refused(mid,errors,run=True):
    e=dict(H)
    if run: e.update(R1)
    e.update(messageId=mid,state='refused',errors=errors); return e
start=ev('RUN_STARTED',**R1); finish=ev('RUN_FINISHED',**R1)
txt=lambda s:{'type':'text','text':s}
snap=lambda mid,a,v,**k: ev('ACTIVITY_SNAPSHOT',messageId=mid,activityType='mugham.fill',content={'format':2,'fill':fact(v)},metadata=meta(a),**k)
streams=[
 dict(name='two people and two agents in one thread', events=[
   start,
   ev('TEXT_MESSAGE_START',messageId='m-1',role='user',metadata=meta(PA)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='Is the loan due?'),
   ev('TEXT_MESSAGE_END',messageId='m-1'),
   ev('TEXT_MESSAGE_START',messageId='m-2',role='user',metadata=meta(PB)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-2',delta='I can renew it.'),
   ev('TEXT_MESSAGE_END',messageId='m-2'),
   ev('TEXT_MESSAGE_START',messageId='m-3',role='assistant',metadata=meta(AP)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-3',delta='The loan is due '),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-3',delta='on 2026-11-20.'),
   ev('TEXT_MESSAGE_END',messageId='m-3'),
   snap('m-4',AC,'2026-11-20'),
   finish],
  expected={'runs':[dict(R1,state='finished')],'messages':[
    msg('m-1',PA,'user','final',[txt('Is the loan due?')]),
    msg('m-2',PB,'user','final',[txt('I can renew it.')]),
    msg('m-3',AP,'assistant','final',[txt('The loan is due on 2026-11-20.')]),
    msg('m-4',AC,'activity','final',[{'type':'component','format':2,'fill':fact('2026-11-20')}])],
   'ignored':0,'errors':[]}),
 dict(name='a message with no actor or an invalid actor is refused', events=[
   start,
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant'),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='Hello'),
   ev('TEXT_MESSAGE_END',messageId='m-1'),
   ev('TEXT_MESSAGE_START',messageId='m-2',role='user',metadata=meta({'type':'robot','id':''})),
   ev('ACTIVITY_SNAPSHOT',messageId='m-3',activityType='mugham.fill',content={'format':2,'fill':fact('2026-11-20')},metadata={'mugham':{}}),
   finish],
  expected={'runs':[dict(R1,state='finished')],'messages':[
    refused('m-1',['metadata.mugham.actor: a required field is missing']),
    refused('m-2',['metadata.mugham.actor.type: must be human, agent or system','metadata.mugham.actor.id: must be an id of 1 to 128 characters']),
    refused('m-3',['metadata.mugham.actor: a required field is missing'])],
   'ignored':2,'errors':[]}),
 dict(name='an undeclared component shows as a refusal', events=[
   ev('ACTIVITY_SNAPSHOT',messageId='m-1',activityType='mugham.fill',content={'format':2,'fill':{'component':'chart','version':'0.1.0','data':{}}},metadata=meta(AC)),
   ev('ACTIVITY_SNAPSHOT',messageId='m-2',activityType='mugham.fill',content={'format':1,'fill':fact('2026-11-20')},metadata=meta(AC)),
   ev('ACTIVITY_SNAPSHOT',messageId='m-3',activityType='other.progress',content={'html':'<b>50%</b>'},metadata=meta(AC)),
   ev('ACTIVITY_DELTA',messageId='m-1',activityType='mugham.fill',patch=[{'op':'replace','path':'/fill/component','value':'fact'}])],
  expected={'runs':[],'messages':[
    msg('m-1',AC,'activity','final',[{'type':'refusal','errors':['component: no contract has the name chart']}],run=False),
    msg('m-2',AC,'activity','final',[{'type':'refusal','errors':['content.format: must be 2']}],run=False)],
   'ignored':2,'errors':[]}),
 dict(name='markup in a text delta stays text', events=[
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant',metadata=meta(AP)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='<img src=x onerror=alert(1)>'),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta=' **bold** <script>alert(1)</script>'),
   ev('TEXT_MESSAGE_END',messageId='m-1')],
  expected={'runs':[],'messages':[
    msg('m-1',AP,'assistant','final',[txt('<img src=x onerror=alert(1)> **bold** <script>alert(1)</script>')],run=False)],
   'ignored':0,'errors':[]}),
 dict(name='a message with no end marker stays partial after the run ends', events=[
   start,
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant',metadata=meta(AP)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='Part one'),
   finish],
  expected={'runs':[dict(R1,state='finished')],'messages':[msg('m-1',AP,'assistant','partial',[txt('Part one')])],
   'ignored':0,'errors':[]}),
 dict(name='a run error marks each open message of the run', events=[
   ev('TEXT_MESSAGE_START',messageId='m-0',role='assistant',metadata=meta(AP)),
   start,
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant',metadata=meta(AP)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='Checking'),
   ev('TEXT_MESSAGE_START',messageId='m-2',role='user',metadata=meta(PA)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-2',delta='Thank you.'),
   ev('TEXT_MESSAGE_END',messageId='m-2'),
   ev('RUN_ERROR',message='The service did not answer.',code='timeout')],
  expected={'runs':[dict(R1,state='error',error={'message':'The service did not answer.','code':'timeout'})],'messages':[
    msg('m-0',AP,'assistant','partial',[txt('')],run=False),
    msg('m-1',AP,'assistant','partial',[txt('Checking'),{'type':'status','state':'error','text':'The service did not answer.','code':'timeout'}]),
    msg('m-2',PA,'user','final',[txt('Thank you.')])],
   'ignored':0,'errors':[]}),
 dict(name='invalid events are ignored with an error and the order stays', events=[
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='Too early'),
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant',metadata=meta(AP)),
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant',metadata=meta(AC)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta=''),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='First'),
   ev('TEXT_MESSAGE_END',messageId='m-1'),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='Too late'),
   ev('TEXT_MESSAGE_END',messageId='m-1'),
   None,
   ev('TOOL_CALL_START',toolCallId='c-1',toolCallName='library.renew'),
   ev('STATE_DELTA',delta=[]),
   finish,
   ev('RUN_STARTED',threadId='t-1',runId=5),
   start,
   ev('RUN_STARTED',threadId='t-1',runId='r-2'),
   ev('TEXT_MESSAGE_START',messageId='m-2',role='robot',metadata=meta(AP))],
  expected={'runs':[dict(R1,state='active')],'messages':[msg('m-1',AP,'assistant','final',[txt('First')],run=False)],
   'ignored':2,'errors':[
    'events[0].messageId: no message has this id',
    'events[2].messageId: the message exists already',
    'events[3].delta: must be a text of 1 character minimum',
    'events[6].messageId: the message has ended',
    'events[7].messageId: the message has ended',
    'events[8]: must be an object with a type',
    'events[11]: no active run has this threadId and runId',
    'events[12].runId: must be an id of 1 to 128 characters',
    'events[14]: a run is already active',
    'events[15].role: must be one of developer, system, assistant, user, tool, reasoning, activity']}),
 dict(name='a snapshot replaces a component and cannot change the actor', events=[
   snap('m-1',AC,'2026-11-20'),
   snap('m-1',AC,'2026-11-27'),
   snap('m-1',AC,'2026-12-04',replace=False),
   snap('m-1',AP,'2026-12-11'),
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant',metadata=meta(AC)),
   ev('TEXT_MESSAGE_START',messageId='m-2',role='assistant',metadata=meta(AC)),
   snap('m-2',AC,'2026-12-11')],
  expected={'runs':[],'messages':[
    msg('m-1',AC,'activity','final',[{'type':'component','format':2,'fill':fact('2026-11-27')}],run=False),
    msg('m-2',AC,'assistant','partial',[txt('')],run=False)],
   'ignored':1,'errors':[
    'events[3].metadata.mugham.actor: must not change',
    'events[4].messageId: the message exists already',
    'events[6].messageId: the message is a text message']}),
 dict(name='a text after a run error comes after the status', events=[
   start,
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant',metadata=meta(AP)),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='Before'),
   ev('RUN_ERROR',message='Failed'),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta='After'),
   ev('TEXT_MESSAGE_CONTENT',messageId='m-1',delta=' again')],
  expected={'runs':[dict(R1,state='error',error={'message':'Failed'})],'messages':[
    msg('m-1',AP,'assistant','partial',[txt('Before'),{'type':'status','state':'error','text':'Failed'},txt('After again')])],
   'ignored':0,'errors':[]}),
 dict(name='a run error with no active run and a second run with one runId are errors', events=[
   ev('TEXT_MESSAGE_START',messageId='m-1',role='assistant',metadata=meta(AP)),
   ev('RUN_ERROR',message='Failed'),
   start, finish, start,
   ev('RUN_ERROR',message='Failed')],
  expected={'runs':[dict(R1,state='finished')],'messages':[msg('m-1',AP,'assistant','partial',[txt('')],run=False)],
   'ignored':0,'errors':['events[1]: no run is active','events[4].runId: a run has this runId already','events[5]: no run is active']}),
 dict(name='a replaced snapshot keeps its run ids and a refused snapshot stays refused', events=[
   start,
   snap('m-1',AC,'2026-11-20'),
   snap('m-2',{'type':'robot','id':''},'2026-11-20'),
   finish,
   snap('m-1',AC,'2026-11-27'),
   snap('m-2',AC,'2026-11-27')],
  expected={'runs':[dict(R1,state='finished')],'messages':[
    msg('m-1',AC,'activity','final',[{'type':'component','format':2,'fill':fact('2026-11-27')}]),
    refused('m-2',['metadata.mugham.actor.type: must be human, agent or system','metadata.mugham.actor.id: must be an id of 1 to 128 characters'])],
   'ignored':1,'errors':[]}),
]
note='Conformance cases for src/envelope/ and docs/contracts/envelope-v1.schema.json. tests/envelope.test.mjs checks each case. The data is synthetic.'


def render(value):
    return json.dumps(value, indent=1) + '\n'


def files():
    return {
        'envelopes.json': render({'note': note + ' "schema" tells if the input agrees with the schema. "result" is'
                                  ' the envelope that readEnvelope gives.', 'fallback': FALLBACK, 'cases': envelopes}),
        'streams.json': render({'note': note + ' "expected" is the result of readStream with the catalog of the kit.',
                                'cases': streams}),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='write the JSON files')
    args = parser.parse_args()
    found = []
    for name, text in files().items():
        path = HERE / name
        if args.write:
            path.write_text(text, encoding='utf-8')
        elif not path.is_file() or path.read_text(encoding='utf-8') != text:
            found.append(f'tests/vectors/envelope/{name} does not agree with generate.py. Run it with --write.')
    print(json.dumps({'passed': not found, 'files': len(files()), 'errors': found}, indent=2))
    return 1 if found else 0


if __name__ == '__main__':
    sys.exit(main())

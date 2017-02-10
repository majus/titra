import { Template } from 'meteor/templating'
import { FlowRouter } from 'meteor/kadira:flow-router'
import moment from 'moment'
import Timecards from '../../api/timecards/timecards.js'
import './tracktime.html'
import '../components/projectselect.js'
import '../components/tasksearch.js'
import '../components/timetracker.js'

Template.tracktime.events({
  'click #save'(event, templateInstance) {
    event.preventDefault()
    // console.log(Template.instance().data.picker.component.item.select.obj)
    // console.log(Template.instance().data.picker)
    Meteor.call('insertTimeCard', { projectId: $('#targetProject').val(),
      date: new Date(Date.parse($('#date').val())),
      hours: $('#hours').val(),
      task: templateInstance.$('.js-tasksearch-input').val() }, (error, result) => {
        if (error) {
          console.error(error)
        } else {
          $('.js-tasksearch-input').val('')
          $('#hours').val('')
          $('.js-tasksearch-results').hide()
          console.log(result)
        }
      })
  },
  'click #previous'(event, templateInstance) {
    event.preventDefault()
    templateInstance.date.set(new Date(moment(templateInstance.date.get()).subtract(1, 'days').utc()))
    $('.js-tasksearch-input').val('')
    $('#hours').val('')
    $('.js-tasksearch-results').hide()
  },
  'click #next'(event, templateInstance) {
    event.preventDefault()
    templateInstance.date.set(new Date(moment(templateInstance.date.get()).add(1, 'days').utc()))
    $('.js-tasksearch-input').val('')
    $('#hours').val('')
    $('.js-tasksearch-results').hide()
  },
})
Template.tracktime.helpers({
  date: () => {
    return new moment(Template.instance().date.get()).format('YYYY-MM-DD')
  },
  projectId: () => {
    if (FlowRouter.getParam('projectId')) {
      return FlowRouter.getParam('projectId')
    }
    return Timecards.findOne() ? Timecards.findOne().projectId : false
  },
  isEdit: () => {
    return FlowRouter.getParam('tcid')
  },
  task: () => {
    return Timecards.findOne() ? Timecards.findOne().task : false
  },
  hours: () => {
    return Timecards.findOne() ? Timecards.findOne().hours : false
  },
})
Template.tracktime.onCreated(function tracktimeCreated() {
  this.date = new ReactiveVar(new Date())
  if (FlowRouter.getParam('tcid')) {
    this.subscribe('singleTimecard', FlowRouter.getParam('tcid'))
    this.autorun(() => {
      if (this.subscriptionsReady()) {
        this.date.set(Timecards.findOne() ? Timecards.findOne().date : new Date())
      }
    })
  }
})
